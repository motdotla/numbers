# numbers

Track leads by phone number. Smartly follow up with them X days later. Interface via SMS so it's all right on your phone.

![](https://raw.github.com/scottmotte/numbers/master/numbers.png)

## Usage

There are a list of commands you can text to the phone number you setup with this. They are:

```
CMD                 # list of commands
ADD number          # add a phone number
REMOVE number       # remove a phone number
LIST                # list all phone numbers that are 'warmed' up. 
LISTALL             # list all phone numbers warmed up or not
```

<small>('Warmed' up phone numbers are numbers that are ready to be contacted after X period of time has passed.)</small>

Generally, after contacting a number you should then remove it from the list by texting `REMOVE number`. This is good practice to keep your list small and maneagable. 

## Installation

### Heroku

```bash
git clone https://github.com/scottmotte/numbers.git
cd numbers
heroku create numbers
heroku addons:add redistogo
git push heroku master
```

Next, we need to setup Twilio. [Create an account](http://twilio.com) and then do the following.

Visit [your list of phone numbers](https://www.twilio.com/user/account/phone-numbers/incoming), click on the number you want to use,
and on the next screen set the Messaging field to `https://yoursubdomain.herokuapp.com/api/v0/twiml/messaging.xml`. Here's a screenshot example.

![](https://raw.github.com/scottmotte/numbers/master/twilio-install-example.png)

#### Optional

Set the X amount of days for warm up. Defaults to 2.

```
heroku config:set DAYS_TILL_WARM=30
```

rawr.
