const utils = require('./lib/utils');
const Translator = require('./lib/Translator.js');
const { translatorId, storagePath, mqttEndpoint, accessToken } = require('./etc/processEnvConfig.js');
const { Logger }   = require('darwin-translator-sdk/utils/Logger.js');


const logger = Logger('App');

async function main() {
    // config block start - if you don`t need any config, remove this block.
    const configuration = await utils.loadOrCreateConfig(storagePath);
    const thingConfig = configuration && configuration.thingConfig
    const schema = configuration && configuration.schema
    const validation = configuration && configuration.validation
    // config block end

    const translator = new Translator({
        translatorId,
        mqttEndpoint,
        accessToken,
        thingConfig, // if you don`t need any config, omit this argument
        schema, // if you don`t need any config, omit this argument
        validation // if you don`t need any config, omit this argument
    });

    logger.info(`STARTING THING TRANSLATOR ${translatorId}`);
    await translator.start();
    logger.info(`STARTED THING TRANSLATOR ${translatorId}`);
}

main().catch(e => logger.error(e));

