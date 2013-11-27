var dotenv      = require('dotenv');
dotenv.load();

var redis       = require('redis');
var sanitize    = require('validator').sanitize;
var Validator   = require('validator').Validator;

var e           = module.exports;
e.ENV           = process.env.NODE_ENV || 'development';

// Constants
var REDIS_URL                 = process.env.REDIS_URL || process.env.REDISTOGO_URL || "redis://localhost:6379";
var DAYS_TILL_WARM            = process.env.DAYS_TILL_WARM || 2;
var NUMBER_WARMED_LIFE_IN_MS  = process.env.NUMBER_WARMED_LIFE_IN_MS || (DAYS_TILL_WARM * 86400000); // ms per day 
var CMD_MESSAGE               = "Available Commands: "+
                                "CMD | ADD number | REMOVE number | LIST";

// Libraries
var redis_url   = require("url").parse(REDIS_URL);
var db          = redis.createClient(redis_url.port, redis_url.hostname);
if (redis_url.auth) {
  db.auth(redis_url.auth.split(":")[1]);
}

var port        = parseInt(process.env.PORT) || 3000;
var Hapi        = require('hapi');
server          = new Hapi.Server(+port, '0.0.0.0', { cors: true });

// Helpers
var Helpers = {
  sendTwimlResponse: function(request, twiml_message) {
    var response = new Hapi.response.Text(
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response><Message>'+twiml_message+'</Message></Response>'
        ,
        'text/xml'
    );

    request.reply(response); 
  }
}

// Setup validation
Validator.prototype.error = function (msg) {
  this._errors.push(new Error(msg));
  return this;
}
Validator.prototype.errors = function () {
  return this._errors;
}

// Models
//// Tidy
var Tidy = module.exports.Tidy = function(self){
  var beginning_of_day_in_ms = +new Date().setHours(0,0,0,0);
  var self                = self || 0;
  this._validator         = new Validator();
  this.number             = sanitize(self.number).trim().toUpperCase().replace(/\D+/g, "") || "";
  this.name               = sanitize(self.name).trim().toUpperCase() || "";
  this.number_warmed_at   = beginning_of_day_in_ms + parseInt(NUMBER_WARMED_LIFE_IN_MS);

  return this;
};

Tidy.list = function(fn){
  var beginning_of_day_in_ms = +new Date().setHours(0,0,0,0);

  // Get all tidies that are 'warmed' up and ready to be contacted. Any with a warmed_at of less than or equal to curent day
  db.ZRANGEBYSCORE("tidies", '-inf', beginning_of_day_in_ms, function(err, res) {
    if (err) { return fn(err, null); }

    var tidies = [];
    var multi_command_array = [];
    res.forEach(function(number) {
      multi_command_array.push(["HGETALL", "tidies/"+number]);
    });
    
    db.multi(multi_command_array).exec(function(err, res) {
      if (err) { return fn(err, null); }

      fn(err, res);
    }); 
  });
}

Tidy.prototype.add = function(fn){
  var _this   = this;
  var key     = "tidies/"+_this.number;

  this._validator.check(_this.number, "Invalid number. Hint: Spaces not allowed.").isNumeric().len(10);

  var errors = this._validator.errors();
  delete(this._validator);

  if (errors.length) {
    fn(errors, null);
  } else {
    db.EXISTS(key, function(err, res) {
      if (err) { return fn(err, null); }

      if (res == 1) {
        var err = new Error("That tidy already exists.");
        fn(err, null);
      } else {
        db.ZADD("tidies", _this.number_warmed_at, _this.number);
        db.HMSET(key, _this, function(err, res) {
          fn(err, _this);
        });
      }
    });
  }

  return this;
};

Tidy.remove = function(number, fn){
  // Just remove from the rolling list. The hash is kept around.
  db.ZREM("tidies", number, function(err, res) {
    if (err) { return fn(err, null); }

    db.DEL("tidies/"+number, function(err, res) {
      if (err) { return fn(err, null); }

      fn(err, res);
    });
  });
};

// Routes
var twiml = {
  messaging: {
    handler: function(request) {
      var payload         = request.payload;
      var body            = sanitize(payload.Body).trim().toUpperCase() || "";
      var split_body      = body.split(" ");

      console.log(split_body);

      var deduced_command = split_body[0]; 
      var twiml_message   = CMD_MESSAGE;

      switch(deduced_command) {
        case "ADD":
          split_body.shift();
          var args            = split_body.join(" ").split(",");
          var number          = args[0];
          var name            = args[1];
          var tidy          = new Tidy({
            number: number,
            name:   name
          });

          tidy.add(function(err, res) {
            if (err) {
              var message       = err.length ? err[0].message : err.message;
              twiml_message = "ERROR: " + message;
            } else {
              twiml_message = "Successfully added " + number;
            }
            
            Helpers.sendTwimlResponse(request, twiml_message);
          });
          break;

        case "REMOVE":
          var number        = split_body[1];

          Tidy.remove(number, function(err, res) {
            if (err) {
              var message       = err.length ? err[0].message : err.message;
              twiml_message = "ERROR: " + message;
            } else {
              twiml_message = "Successfully removed " + number;
            }

            Helpers.sendTwimlResponse(request, twiml_message);
          });
          break;

        case "LIST":
          Tidy.list(function(err, res) {
            if (err) {
              var message   = err.length ? err[0].message : err.message;
              twiml_message = "ERROR: " + message;
            } else {
              twiml_message = "";
              res.forEach(function(tidy) {
                twiml_message += tidy.number+" , "+tidy.name+" | ";
              });
              if (twiml_message.length <= 0) {
                twiml_message += "No warm numbers today. Try tomorrow."
              }
            }

            Helpers.sendTwimlResponse(request, twiml_message);
          });
          break;

        case "CMD":
          // uses CMD_MESSAGE
          Helpers.sendTwimlResponse(request, twiml_message);
          break;

        default:
          Helpers.sendTwimlResponse(request, twiml_message);
          // uses CMD_MESSAGE
      }
    }
  }
}

server.route({
  method  : 'POST',
  path    : '/api/v0/twiml/messaging.xml',
  config  : twiml.messaging
});

server.start(function() {
  console.log('Handshake.js server started at: ' + server.info.uri);
});
