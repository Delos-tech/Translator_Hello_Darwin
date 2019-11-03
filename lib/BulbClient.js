const { Logger } = require("darwin-translator-sdk/utils/Logger.js");
//const bulbToNVA = require("./mapping/DarwinBulbToNVA");
const CoreStateComparator = require("./CoreStateComparator");

const logger = Logger("CoreChannel");

class BulbClient {
  constructor({ translator: translator }) {
    this.coreChannel = translator.coreChannel;
    this.translatorId = translator.translatorId;
    this.accessToken = translator.accessToken;

    this.coreStateComparator = new CoreStateComparator({
      translatorId: this.translatorId
    });
  }

  async _getCoreState() {
    // Retry until core responds
    while (true) {
      // eslint-disable-line no-constant-condition
      try {
        const coreObjState = await this.coreChannel.executeNVA({
          nva: [
            { verb: "get", adverb: { "source.translator": this.translatorId } }
          ],
          sourceTranslator: this.translatorId,
          manipulatorId: this.translatorId,
          accessToken: this.accessToken
        });
        const coreState = [];

        for (const device of coreObjState) {
          const { data } = device;

          coreState.push(...data);
        }
        return coreState;
      } catch (error) {
        if (error) logger.error(error);
        logger.info("Retrying to get state from Core...");
        await utils.wait(5000);
      }
    }
  }

  async bulbListenerHandler(message) {
    logger.debug(`Listener message ${JSON.stringify(message)}`);
    const bulbInfo = message.data;

    try {
      logger.info("Syncing devices");
      const { data: coreState } = await this._getCoreState().bind(this);

      this._syncDevicesIDs(coreState);

      const bulbsInfo = [bulbInfo];
      const {
        createNVAs,
        updateNVAs
      } = this.coreStateComparator.preparePatchNVAs({
        bulbsInfo,
        coreState
      });

      logger.debug(
        `Create NVAs for syncing: ${JSON.stringify(createNVAs, null, 2)}`
        // `Create NVAs for syncing: ${util.inspect(createNVAs, false, 3, false)}`
      );
      logger.debug(
        `Update NVAs for syncing: ${JSON.stringify(updateNVAs, null, 2)}`
        // `Update NVAs for syncing: ${util.inspect(updateNVAs, false, 3, false)}`
      );

      for (const createNVA of createNVAs) {
        const { data } = await this.coreChannel.executeNVA({
          nva: [createNVA],
          sourceTranslator: this.translatorId,
          manipulatorId: this.translatorId,
          accessToken: this.accessToken
        });

        // this.thingsIDsMapManager.setRelation({
        //   coreId: data.id,
        //   bulbId: data.source.id
        // });
      }

      if (!updateNVAs.length) return;

      await this.coreChannel.executeNVA({
        nva: updateNVAs,
        sourceTranslator: this.translatorId,
        manipulatorId: this.translatorId,
        accessToken: this.accessToken
      });
    } catch (e) {
      logger.error(e);
      logger.debug(e.stack);
    }
  }

  async _syncDevicesIDs(coreState) {
    const deletedFromCoreDevicesIDs = this.bulbsManager.getDeletedFromCoreDevicesIDs(
      coreState
    );

    for (const deletedFromCoreDeviceID of deletedFromCoreDevicesIDs) {
      this.thingsIDsMapManager.deleteRelationBybulbId(deletedFromCoreDeviceID);
    }

    for (const coreThing of coreState) {
      this.thingsIDsMapManager.ensureRelation({
        coreId: coreThing.id,
        bulbId: coreThing.source.id
      });
    }
  }

  async _updateCoreThing({ coreThingState, bulbId }) {
    const updatedbulbInfo = await this.bulbsManager.getUpdatedDeviceInfo(
      bulbId
    );
    const updateNVAsToPatchCoreState = this.coreStateComparator.getUpdateNVAQueries(
      updatedbulbInfo,
      coreThingState
    );

    if (!updateNVAsToPatchCoreState.length) return;

    logger.info("Updating Core thing");
    logger.debug(
      `NVAs for update: ${util.inspect(
        updateNVAsToPatchCoreState,
        false,
        3,
        false
      )}`
    );

    await this.coreChannel.executeNVA({
      nva: updateNVAsToPatchCoreState,
      sourceTranslator: this.translatorId,
      manipulatorId: this.translatorId,
      accessToken: this.accessToken
    });
  }

  async _processSystemConfigurableNVA({ noun, verb, adverb }) {
    /* eslint-disable default-case */
    switch (verb) {
      case "darwin/thing/setsource_id": {
        // Removing old relation
        const oldbulbId = this.thingsIDsMapManager.getbulbIdByCoreId(noun);

        this.thingsIDsMapManager.deleteRelationBybulbId(oldbulbId);

        // Setting new relation
        this.thingsIDsMapManager.setRelation({
          coreId: noun,
          bulbId: adverb.value
        });
      }
    }
    /* eslint-enable default-case */
  }
}

module.exports = BulbClient;
