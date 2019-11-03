const fs = require("fs");
const util = require("util");
const path = require("path");

const LIVR = require("livr"); // if you don`t need config, you can remove this require

const { Logger } = require("darwin-translator-sdk/utils/Logger.js");

const { storagePath } = require("../etc/processEnvConfig.js"); // if you don`t need config, you can remove this require

const logger = Logger("Utils");

function waitForEvent(emitter, eventName) {
  return new Promise(resolve => {
    emitter.on(eventName, resolve);
  });
}

// json utils
function parse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    logger.error(`JSON.parse error: ${e}`);
    return null;
  }
}

function stringify(obj) {
  return typeof obj === "string" ? obj : JSON.stringify(obj);
}
// json utils end

// config utils start - if you don`t need config, remove this block
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

const readFileJSON = async (...args) => parse(await readFile(...args));

async function exists(filePath) {
  return new Promise(res => {
    fs.access(filePath, fs.constants.F_OK, err => {
      return err ? res(false) : res(true);
    });
  });
}

async function loadOrCreateConfig(
  configStoragePath = storagePath,
  encoding = "utf8"
) {
  const remoteConfigPath = path.join(configStoragePath, "config.json");
  const remoteConfigExists = await exists(remoteConfigPath);
  let schema;
  let validation;

  try {
    const schemaPath = path.join("etc", "schema.json");
    const schemaObject = await readFileJSON(schemaPath, encoding);

    schema = schemaObject ? schemaObject.schema : null;
    validation = schemaObject ? schemaObject.validation : null;
  } catch (e) {
    logger.error(`Can't read schema: ${e}`);
  }

  if (remoteConfigExists) {
    try {
      const file = await readFileJSON(remoteConfigPath, encoding);

      return {
        thingConfig: file,
        schema,
        validation
      };
    } catch (e) {
      logger.error(`Can't read remote config file: ${e}`);
    }
  } else {
    try {
      const localConfigPath = path.join("etc", "default-config.json");
      const localConfig = await readFileJSON(localConfigPath, encoding);

      await writeFile(remoteConfigPath, stringify(localConfig));

      return {
        thingConfig: localConfig,
        schema,
        validation
      };
    } catch (e) {
      logger.error(`Can't read local config file: ${e}`);
    }
  }

  return { schema, validation };
}

function createValidator(validationRules) {
  return async function validate(config) {
    if (!config) return { error: "No config was provided" };
    if (!validationRules) return { result: config };

    const validator = new LIVR.Validator(validationRules);
    return validateWithLIVR(config, validator);
  };
}

async function saveConfig(config) {
  /*
        This method should return the result of saving config: { result: 'Some_result' } or { error: 'Error' }.
        You can make your own implementation here or use implemented "save" function:
     */
  if (!config) return { error: "No config was provided" };

  return save(config, storagePath, "config.json");
}

// async function validateConfig(config, validator) {
//     /*
//         This method should return the result of validating config:
//         - success result: { result: 'Some_result' };
//         - error result:
//             a) general error, for example: { error: 'Connection problems on check credentials' };
//             b) error by fields, for example: { error:
//                 { fields:
//                     { field1: 'Field1 is required' },
//                     { field2: 'Field2 must be email' }
//                  }
//                }
//
//         You can make your own validator here or use "validateWithLIVR":
//      */
//
//     if (!config) return { error: 'No config was provided' }
//     if (!validator) return { result: config } // through no validator was provided, you can still implement other validations and return result based on this validations
//
//     return validateWithLIVR(config, validator)
// }

function validateWithLIVR(config, validator) {
  const validatedConfig = validator.validate(config);

  if (validatedConfig) return { result: validatedConfig };

  const validationErrors = validator.getErrors();

  logger.error(`Config validation fails: ${JSON.stringify(validationErrors)}`);

  return { error: { fields: validationErrors } };
}

async function save(
  config,
  configStoragePath = storagePath,
  configFileName = "config.json"
) {
  try {
    const pathToWrite = path.join(configStoragePath, configFileName);
    await writeFile(pathToWrite, stringify(config), "utf-8");

    return { result: "Config was successfully saved" };
  } catch (err) {
    logger.error(`Can\'t save config: ${err}`);

    return { error: "Can't save config" };
  }
}

// config utils end

module.exports = {
  waitForEvent,
  loadOrCreateConfig, // if you don`t need config, remove this line
  createValidator, // if you don`t need config, remove this line
  saveConfig // if you don`t need config, remove this line
};
