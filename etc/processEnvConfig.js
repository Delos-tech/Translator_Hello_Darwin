module.exports = {
    translatorId : process.env.TRANSLATOR_ID || '160985ae-833c-4184-a941-065e244938dc',
    storagePath  : process.env.STORAGE_PATH || 'etc/',
    mqttEndpoint : process.env.MQTT_ENDPOINT || 'tcp://10.1.1.100:1883',
    accessToken  : process.env.ACCESS_TOKEN || '26ad0950-b480-4365-b47e-4c84df029aaa'
};
