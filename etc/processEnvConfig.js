module.exports = {
    translatorId : process.env.TRANSLATOR_ID || 'bdc60744-14fb-4024-acee-a86d7db1ff80',
    storagePath  : process.env.STORAGE_PATH || 'etc/',
    mqttEndpoint : process.env.MQTT_ENDPOINT || 'tcp://10.1.1.120:1883',
    accessToken  : process.env.ACCESS_TOKEN || 'c0bcdf82-162f-4c6c-85d2-a86ca3da332a'
};
