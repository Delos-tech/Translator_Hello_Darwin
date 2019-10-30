# Thing translator template

## Run Thing Template Translator on local machine in development mode

A translator communicates with some 'thing' and with Darwin core (through mqtt). There are use cases such as NLP that
also a part of a translator.

1. [Development Environment](#development-environment)
2. [Install Dependencies](#install-dependencies)
3. [Environment Settings](#environment-settings)
4. [Create config if needed](#configuration)
5. [Create a Thing Client](#create-thing-client)
6. [Create NVA to Thing mapping](#nva-to-thing)
7. [Create Thing to NVA mapping](#thing-to-nva)
8. [Deploying Your Translator](#translator-deploy)

## Development environment

    1.1. Ubuntu Linux or OSX

    1.2. NodeJS LTS >=10.7.0

    1.3. npm version >=6.1.0

## Install dependencies
Install dependencies and start node dev mode

```bash
    npm install
    npm run nodemon
```


1. When a translator is installed in the Darwin system it is registered with that core and will receive messages from
it. However during development you may want to just run your translator locally. You can do this by uncommenting the
line ```enableLocalTranslatorDev()``` in translator.js

## Environment Settings
1. Edit processEnvConfig.js and set there TRANSLATOR_ID and MQTT_ENDPOINT from Raspberry Pi.

    1. We use a UUID version 4 for translator IDs.

## Configuration
Frequently the translator will need to store configuration data for the 'thing'. Most commonly stored are data like url, and
credentials.

### In case you DON'T NEED a config.

Remove unnecessary code concerning configuration from 'app.js', 'lib/Translator.js' and 'lib/utils.js' files. These parts of code are
    marked with comments.

### In case you NEED a config:

1. Create default config in "default-config.json" (in "etc" directory) to save thing configurations and
       credentials. For example:

      ```javascript
                  {
                    "apiEndpoint": "",
                    "preferredLanguage": "en",
                    "interactionTime": [ "morning", "bedtime" ],
                    "useMetricSysytem": true,
                    "usbDevices": []
                  }
      ```

1. Create schema that will describe your config - fill schema "fields" in [schema.json](./etc/schema.json).

     This schema will be used to let users set their custom values in your config from UI.\
      You can use the following types of fields:

      | Type | Description | UI render |
      | ---- | ----------- | --------- |
      | text | user can input any text value | text input |
      | url | user can input url | url input |
      | email | user can input email | email input |
      | password | user can input password | password input |
      | select | user can select one of predefined values | select |
      | multiselect | user can select one or more from predefined values | multiselect |
      | radio | user can select one of predefined values | radiobuttons |
      | checkbox | user can mark value as true/false | checkbox |
      | checkboxGroup | user can select multiple values | multiple checkboxes |

      Each field should be described according to the following example:
      <details>
        <summary>field with custom user input (for types <strong>text</strong>, <strong>url</strong>, <strong>email</strong>, <strong>password</strong>)</summary>

       ```javascript
               {
                   //    unique field name
                   "name": "apiEndpoint",

                   //    field label to display to user on UI
                   "label": "API endpoint",

                   //    type of input to display to user on UI
                   "type": "url",

                   //    (optional) determine if user can set this field value
                   "disabled": false,

                   //    (optional) placeholder to display for user input on UI
                   "placeholder": "API endpoint",

                   //    (optional) default value that will be set to this field if user did not specified value from UI
                   "defaultValue": ""
               }
               ```
      </details>

      <details>
              <summary>field with select (for types <strong>select</strong>, <strong>radio</strong>)</summary>

        ```javascript
        {
            //    unique field name
            "name": "preferredLanguage",

            //    field label to display to user on UI
            "label": "Preferred language",

            //    type of input to display to user on UI
            "type": "select",

            //    (optional) determine if user can set this field value
            "disabled": false,

            //    (optional) placeholder to display for user input on UI. (For "radio" field type will be ignored)
            "placeholder": "",

            //    (optional) default value that will be set to this field if user did not specified value from UI
            "defaultValue": "en",

            //    options for users to choose. "Key" field will be shown to user on UI, and "value" field will be saved in config when user pick some option.
            "options": [
                {
                    "key":"English",
                    "value": "en"
                },
                {
                    "key":"Italian",
                    "value": "it"
                },
                {
                    "key":"Portugal",
                    "value": "pt"
                },
            ]
        }
        ```
      </details>

      <details>
          <summary>field with multiple select (for type <strong>checkboxGroup</strong> and <strong>multiselect</strong>)</summary>

        ```javascript
        {
            //    unique field name
            "name": "interactionTime",

            //    field label to display to user on UI
            "label": "Do not disturb me",

            //    type of input to display to user on UI
            "type": "checkboxGroup",

            //    (optional) determine if user can set this field value
            "disabled": false,

            //    (optional) placeholder to display for user input
            "placeholder": "",

            //    (optional) default value that will be set to this field if user did not specified value from UI
            "defaultValue": [ "morning", "bedtime" ],

            //    options for users to choose. "Key" field will be shown to user on UI, and "value" field will be saved in config when user pick some option.
            "options": [
                {
                    "key": "At morning",
                    "value": "morning"
                },
                {
                    "key": "Afternoon",
                    "value": "afternoon"
                },
                {
                    "key": "Bedtime",
                    "value": "bedtime"
                },
                {
                    "key": "All day long",
                    "value": "all_day"
                }
            ]
        }
        ```
      </details>

      <details>
           <summary>field that will be marked as true/false (for type <strong>checkbox</strong>)</summary>

        ```javascript
        {
            //    unique field name
            "name": "useMetricSystem",

            //    field label to display to user on UI
            "label": "Use metric system",

            //    type of input to display to user on UI
            "type": "checkbox",

            //    (optional) determine if user can set this field value.
            "disabled": false,

            //    (optional) default value that will be set to this field if user did not specified value from UI
            "defaultValue": true
        }
        ```
      </details>

      <details>
             <summary>field that will asynchronously set options from Darwin Core entities via NVA (for types <strong>checkboxGroup</strong>, <strong>multiselect</strong>, <strong>select</strong> and <strong>radio</strong>)</summary>

          ```javascript
          {
              //    unique field name
              "name": "usbDevices",

              //    field label to display to user on UI
              "label": "Select usb devices",

              //    type of input to display to user on UI
              "type": "select",

              //    (optional) placeholder to display for user input
              "placeholder": "",

              //    nva query that will fetch data for field options
              "optionsNVA": "hardware.get@usb",

              //    fields that will be taken from nva data object and set to options. "Key" field will be shown to user on UI, and "value" field will be saved in config when user pick some option.
              "optionsMap": {
                    "key": "id_serial",
                    "value": "path"
              }
          }
          ```
        </details>

      &#x2757; Pay attention
      * When defining options from NVA, make sure your translator have corresponding allowed permissions for particular NVA in Core, otherwise User could not pick options and set values to your config.
      * In order to get USB devices and set it to options, your translator must be published with additional permission "DEVICE:USB". You should declare it in [metadata.json](./metadata.json) "permissions" field.


      List with examples of all acceptable types of fields you can find in [schemaFieldsExample.json](./etc/schemaFieldsExample.json).

3. Create validation for config - fill "validation" section in [schema.json](./etc/schema.json).

    It will be used to validate config that user want to set to your translator from UI.

    You should use [LIVR](http://livr-spec.org/) validation library when describing validation.

    For example, for config from example above, validation will look like this:

    ```javascript
    {
        "apiEndpoint": [ "required", "string" ],
        "preferredLanguage": [ "string" ],
        "interactionTime": [ "list_of": "string" ],
        "useMetricSysytem": { "one_of": [ true, false ] },
        "usbDevices": [ "list_of": "string" ]
    }
    ```
## Create a Thing Client
The thing client will handle communications to and from the 'thing'. Utilizing the mapping files to convert the data and command
format to and from NVA.

## Write Mapping files
Mapping files aren't required but
### Nva to Thing
An incoming NVA may look like
```javascript
// light.on
[ {
    "noun": "light",
    "verb": "base/power/toggle",
    "adverb" : {}
}]
```
A nvaToThing.js file may include the following.
```javascript
    'base/power/on' : {
        name    : 'power',
        value   : () => ({
            capability  : 'switch',
            command     : 'on',
            arguments   : [],
        })
    },
    'base/power/off': {
        name    : 'power',
        value   : () => ({
            capability  : 'switch',
            command     : 'off',
            arguments   : [],
        })
    },
    'base/power/toggle': {
        name    : 'power',
        value   : ({ thingState }) => ({
            capability  : 'switch',
            command     : thingState.state,
            arguments   : [],
        })
    }
```

In this case the match is obvious and will return the data needed to make a call the 'Things' api.

### Thing to Nva
This will take a response from the 'thing' and convert it to NVA
```javascript
    'switch': {
        nva: {
            verb: 'set',
            adverb: ({data}) => ({
                state: data.value
            })
        }
    },
```
In this case the 'thing' has sent a command saying a switch was changes and the above will map that to an NVA object
that can then be sent to Darwin core.


## Publish translator via cli (Update translator docker image in registry)
- https://github.com/Delos-tech/Darwin_Dev_CLI

```bash
    darwin registration
    darwin login
```
- You need to log in only once, after login to publish translator:
```bash
    darwin publish translator <path>
```
- Translator must include metadata.json file and logo in repository
# Translator_Hello_Darwin
