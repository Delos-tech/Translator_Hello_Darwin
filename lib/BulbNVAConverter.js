const nvaToBulb = require("./mapping/nvaToBulb");
const { throwError } = require("./BulbException");

class BulbNVAConverter {
  convertNVAToBulbPayload(nva, thingState = {}) {
    if (this._isSystemNVA(nva)) {
      const { isSystemConfigurable } = nvaToBulb.system[nva.verb];

      return { isSystemConfigurable };
    }

    const { name, args, requiredFields } = nvaToBulb.device[nva.verb];

    if (requiredFields) {
      requiredFields.forEach(requiredField => {
        if (nva.adverb[requiredField] === undefined) {
          throwError("ADVERB_FIELD_REQUIRED", {
            field: requiredField,
            verb: nva.verb
          });
        }
      });
    }

    const method =
      typeof name === "function" ? name({ nva, thingState }) : name;
    const preparedArgs =
      typeof args === "function" ? args({ nva, thingState }) : args;

    return {
      method,
      args: preparedArgs
    };
  }

  isSupportedNVAVerb(verb) {
    return !!nvaToBulb.device[verb] || !!nvaToBulb.system[verb];
  }

  _isSystemNVA(nva) {
    return nva.verb.split("/")[0] === "darwin";
  }
}

module.exports = BulbNVAConverter;
