module.exports = {
    // by Thing item name
    'create' : {
        nva : {
            tags : {
                power  : 'base/power',
                color  : "base/color",
                light  : 'light',
                darwinbulb   : 'darwinbulb'
            }
        }
    },
    'color' : {
        thingState : {
            'base/power' : {
                name  : 'state',
                value : lifxDeviceInfo => !!lifxDeviceInfo.power ? 'on' : 'off'
            }
        },
    },
    'on' : {

    }
}
