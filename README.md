# numbers

Track leads by phone number. Smartly follow up with them X days later. Interface via SMS so it's all right on your phone.

## Usage

There are a list of commands you can text to the phone number you setup with this. They are:

```
CMD                 # list of commands
ADD number          # add a phone number
REMOVE number       # remove a phone number
LIST                # list all phone numbers that have are 'warmed' up. 
```

('Warmed' up phone numbers are numbers that are ready to be contacted after X period of time has passed.)

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

#### Optional

Set the X amount of days for warm up. The default is 2.

```
heroku config:set DAYS_TILL_WARM=30
```

rawr.
