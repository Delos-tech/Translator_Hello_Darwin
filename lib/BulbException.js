const { Logger } = require("darwin-translator-sdk/utils/Logger.js");

const logger = Logger("BulbException");

class BulbException extends Error {
  constructor({ code, reason }) {
    super(code);
    this.code = code;
    this.reason = reason;
  }
}

module.exports = {
  X: BulbException,
  throwError(code, payload) {
    const errors = {
      WRONG_NVA_TYPE: () => {
        throw new BulbException({
          code,
          reason: `NVAs: ${payload.NVAs}`
        });
      },
      VERB_IS_NOT_SUPPORTED: () => {
        throw new BulbException({
          code,
          reason: `Verb: ${payload.verb}`
        });
      },
      NO_LIFX_DEVICE_RESPONSE: () => {
        throw new BulbException({
          code,
          reason: `No response from device ${payload.deviceId}`
        });
      },
      ADVERB_FIELD_REQUIRED: () => {
        throw new BulbException({
          code,
          reason: `Field ${payload.field} is requried in adverb for verb ${payload.verb}`
        });
      }
    };

    if (!errors[code]) {
      logger.error(`Error with code ${code} not handled.`);
      throw new Error("UNKNOWN_ERROR");
    }

    errors[code]();
  }
};
