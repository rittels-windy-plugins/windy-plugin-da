import utils from '@windy/utils';
import { map } from '@windy/map';
import store from '@windy/store';
import bcast from '@windy/broadcast';
import { emitter as picker } from '@windy/picker';
import http from '@windy/http';
import rootScope from '@windy/rootScope';
import windyFetch from '@windy/fetch';
//import interpolator from '@windy/interpolator';
import loc from '@windy/location';
import geoloc from '@windy/geolocation';
import products from '@windy/products';

import * as singleclick from '@windy/singleclick';

import config from './pluginConfig';

import { insertGlobalCss, removeGlobalCss } from './globalCss.js';
import { getPickerMarker } from 'custom-windy-picker';
import { coordsToFields } from './coordinates.js';
import { postData, cleanupSync } from './sync_tabs.js';
import { cleanupOther } from './other.js';

const { name } = config;
const { $, getRefs } = utils;

const { log } = console;
const { round, pow, atan, sqrt, abs, trunc, sign, exp } = Math;

const ft2m = 0.3048;

let thisPlugin, refs, node;

let hasHooks;
let pickerT;

let settings = {
    syncmap: false,
    synctimestamp: false,
    syncoverlay: false,
    synclevel: false,
    syncmodel: false,
    syncPickers: false,
    hideLabels: false,
    hideMenus: false,
};

const allParameters = [
    'temp',
    'dewpoint',
    'precip',
    'convPrecip',
    'wind',
    'windGust',
    'cape',
    'ptype',
    'lclouds',
    'mclouds',
    'hclouds',
    'rh',
    'pressure',
    'cbase',
    'visibility',
    'weatherWarnings',
];
let parameters = allParameters;

let levels = [
    'surface',
    '1000h',
    '950h',
    '925h',
    '900h',
    '850h',
    '800h',
    '700h',
    '600h',
    '500h',
    '400h',
    '300h',
    '200h',
    '150h',
];

let loggerTO;

let bathyReqTime;

let wxdata;
let lastpos;
let prod = 'ecmwf';

const K = -273.15;

let ts = Date.now();

let vals = [
    { metric: 'altitude', txt: 'Elev' },
    { metric: 'altitude', txt: 'Depth' }, //will be made meters
    { metric: 'altitude', txt: 'PA', menu: 'Pressure Alt' },
    { metric: 'altitude', txt: 'DA', menu: 'Density Alt' },
    { metric: 'altitude', txt: 'DA_dp', menu: 'DA corrected for DP' },
    { metric: 'pressure', txt: 'QNH' },
    { metric: 'temp', txt: 'Temp' },
    { metric: 'temp', txt: 'Dew Point' },
    { metric: 'temp', txt: 'Wet Bulb', menu: 'Wet Bulb (Stull formula)' },
    { metric: 'temp', txt: '&Delta;T', menu: '&Delta;T = Temp - Wet Bulb' },
    { metric: 'temp', txt: 'Apparent T', menu: 'Apparent T (Steadman)' },
    { metric: 'rh', txt: 'Humidity' },
    { metric: 'rain', txt: 'Rain' },
    { metric: 'rain', txt: 'Convective rain' },
    { metric: 'altitude', txt: 'Cloudbase' },
    // { metric: '', txt: 'Wx code: ' },
    { metric: 'wind', txt: 'Wind' },
    { metric: 'wind', txt: 'Gust' },
    { metric: '', txt: `DDD°MM'SS.S"` },
    { metric: '', txt: `DDD°MM.MMM'` },
    { metric: '', txt: `DDD.DDDDD°` },
];

//  only have to add a parameter to vals,  the number does not have to specified for store etc
let nVals = vals.length;

function logMessage(msg) {
    const device = rootScope.device;
    if (!store.get('consent')) return; // store.get('consent') sometimes returns null and not an object
    if (!store.get('consent').analytics) return;
    fetch(
        `https://www.flymap.org.za/windy-logger/logger.htm?name=${name}&message=${msg}&device=${device}`,
        { cache: 'no-store' },
    ).then(console.log);
}

function init(plgn) {
    thisPlugin = plgn;

    node = document.getElementById('plugin-' + thisPlugin.ident);

    ({ refs } = getRefs(node));

    // important to close picker
    bcast.fire('rqstClose', 'picker');

    //??? should I open my picker if windy picker was open

    pickerT = getPickerMarker();

    // todo move this to svelte later

    for (let rows = refs.choose.children, i = 0; i < rows.length; i++) {
        $('.left', rows[i]).classList[getChoices('left')[i] == 0 ? 'add' : 'remove'](
            'checkbox--off',
        );
        $('.right', rows[i]).classList[getChoices('right')[i] == 0 ? 'add' : 'remove'](
            'checkbox--off',
        );
    }
    refs.choose.addEventListener('click', onChoose);

    refs.togglePickerElevation.addEventListener('click', e => {
        refs.togglePickerElevation.classList.toggle('checkbox--off');
        store.set(
            'showPickerElevation',
            !refs.togglePickerElevation.classList.contains('checkbox--off'),
        );
    });
    refs.togglePickerElevation.classList[store.get('showPickerElevation') ? 'remove' : 'add'](
        'checkbox--off',
    );
    refs.togglePickerCoordinates.addEventListener('click', e => {
        refs.togglePickerCoordinates.classList.toggle('checkbox--off');
        store.set('latlon', !refs.togglePickerCoordinates.classList.contains('checkbox--off'));
    });
    refs.togglePickerCoordinates.classList[store.get('latlon') ? 'remove' : 'add']('checkbox--off');

    let myloc = geoloc.getMyLatestPos();
    if (myloc) coordsToFields(myloc);

    let headings = (+store.get('plugin-da-sections')).toString(2).padStart(5, '0');
    node.querySelectorAll('.toggle-section').forEach((e, i) =>
        e.classList[headings[i] == '1' ? 'add' : 'remove']('off'),
    );

    if (hasHooks) return;

    // log message
    let devMode = loc.getURL().includes('windy.com/dev');
    logMessage(devMode ? 'open_dev' : 'open_user');
    if (!devMode) loggerTO = setTimeout(logMessage, 1000 * 60 * 3, '3min');
    //

    // click stuff
    singleclick.singleclick.on(name, pickerT.openMarker);
    bcast.on('pluginOpened', onPluginOpened);
    bcast.on('pluginClosed', onPluginClosed);

    insertGlobalCss();

    pickerT.onDrag(fetchData, 200);
    picker.on('pickerOpened', fetchData);
    picker.on('pickerMoved', pickerMoved);

    store.on('timestamp', setTs);
    store.on('product', setProd);
    setProd();
    bcast.on('metricChanged', onMetricChanged);

    // neeeded???
    thisPlugin.closeCompletely = closeCompletely;

    hasHooks = true;
}

const closeCompletely = function () {
    console.log('DA close completely');

    clearTimeout(loggerTO);

    cleanupOther();
    cleanupSync();

    removeGlobalCss();

    pickerT.offDrag(fetchData);
    picker.off('pickerOpened', fetchData);
    picker.off('pickerMoved', pickerMoved);
    pickerT.remLeftPlugin(name);
    pickerT.remRightPlugin(name);

    bcast.off('metricChanged', onMetricChanged);
    store.off('timestamp', setTs);
    store.off('product', setProd);

    // click stuff
    singleclick.release(name, 'high');
    singleclick.singleclick.off(name, pickerT.openMarker);
    bcast.off('pluginOpened', onPluginOpened);
    bcast.off('pluginClosed', onPluginClosed);
    bcast.fire('rqstClose', name);

    // other plugins will try to defocus this plugin.
    delete thisPlugin.focus;
    delete thisPlugin.defocus;

    pickerT = null; // in case plugin re-opened
    hasHooks = false;
};

function onPluginOpened(p) {
    // other external plugins do not get priority back,  when later reopened,  like better sounding.
    if (W.plugins[p].listenToSingleclick && W.plugins[p].singleclickPriority == 'high') {
        singleclick.register(p, 'high');
    }
}
function onPluginClosed(p) {
    // if the plugin closed has high singleclickpriority,  it returns single click to default picker,
    // so instead register this plugin as priority high
    if (p !== name && W.plugins[p].singleclickPriority == 'high') {
        console.log('on plugin closed:', p, '  This plugin gets priority:', name);
        singleclick.register(name, 'high');
    }
}

export { init, closeCompletely };

store.insert('plugin-da-selected-vals-left', {
    def: parseInt('000011100011'.padEnd(nVals, '0'), 2),
    allowed: v => v >= 0 && v < pow(2, nVals),
    save: true,
});
store.insert('plugin-da-selected-vals-right', {
    def: parseInt('1111'.padEnd(nVals, '0'), 2),
    allowed: v => v >= 0 && v < pow(2, nVals),
    save: true,
});
store.insert('plugin-da-sections', {
    def: parseInt('11000', 2),
    allowed: v => v >= 0 && v < pow(2, 5),
    save: true,
});

function getChoices(side) {
    let sv = store.get('plugin-da-selected-vals-' + side);
    let choices = sv.toString(2).padStart(nVals, '0').split('').map(Number);
    return choices;
}

function isChoiceSelected(txt) {
    let ix = vals.findIndex(e => e.txt == txt);
    return getChoices('left')[ix] == 1 || getChoices('right')[ix] == 1;
}
//read query data

function useQuery(query) {
    let { lat, lng } = map.getCenter();
    if (query) {
        let q = query;
        for (let p in q) {
            switch (p.toUpperCase()) {
                case 'DATE':
                    let d = new Date(q[p]);
                    if (d != 'Invalid Date') ts = d.getTime();
                    else console.log('INVALID date');
                    break;
                case 'LAT':
                    if (!isNaN(Number(q[p]))) lat = Number(q[p]);
                    break;
                case 'LNG':
                case 'LON':
                    if (!isNaN(Number(q[p]))) lng = Number(q[p]);
                    break;
            }
        }
        lastpos = { lat, lon: lng };
        map.setView(lastpos);
        setTimeout(() => bcast.fire('rqstOpen', whichPicker(), lastpos), 1000);
        store.set('timestamp', ts);
        //setURL();
    }
}

function setURL() {
    W.location.setUrl(
        `plugins/windy-plugin-da?lat=${lastpos.lat.toFixed(5)}&lng=${lastpos.lon.toFixed(5)}&date=${new Date(ts).toISOString().slice(0, 16)}`,
    );
}

function pickerMoved(e) {
    if (e.source == 'picker') return; // only react on custom-picker
    //if (pickerT.getActivePlugin() != name) return;
    //elevfnd = datafnd = true;
    setTimeout(fetchData, 50, e);
}

function onMetricChanged() {
    let c = pickerT.getParams();
    if (c) {
        fetchData(c);
    }
}

function setTs(t) {
    ts = t;
    let c = pickerT.getParams();
    if (c) {
        fetchData(c);
    }
}

function setProd(e) {
    prod = e;
    parameters = allParameters;
    if (lastpos) fetchData(lastpos);
}

function parseWxCode(c) {
    let wc = c.replace(/,/g, ' ');
    return wc;
}

function readChoices(lastClick, side) {
    let otherSide = side == 'left' ? 'right' : 'left';

    let els = {
        left: [...refs.choose.children].map((e, i) => $('.left', e)),
        right: [...refs.choose.children].map(e => $('.right', e)),
    };

    let choices = {};
    for (let p in els) {
        choices[p] = els[p].map(e => !e.classList.contains('checkbox--off'));
    }

    if (choices[side][lastClick] && choices[otherSide][lastClick]) {
        els[otherSide][lastClick].classList.add('checkbox--off');
        choices[otherSide][lastClick] = false;
    }

    for (let p in choices) {
        if (choices[p].filter(e => e).length > 5) {
            let i;
            for (
                i = choices[p].length - 1;
                i > 0 && (choices[p][i] == false || i == lastClick);
                i--
            );
            choices[p][i] = false;
            els[p][i].classList.add('checkbox--off');
        }
        store.set('plugin-da-selected-vals-' + p, parseInt(choices[p].map(Number).join(''), 2));
    }
}

function onChoose(e) {
    let tg = e.target;
    let ix, side;
    if (tg.classList.contains('checkbox')) {
        tg.classList.toggle('checkbox--off');
        ix = [...refs.choose.children].findIndex(e => e.contains(tg));
        side = tg.classList.contains('left') ? 'left' : 'right';
    }
    readChoices(ix, side);
    calculate();
}

function makePickerTextAndFill(vals) {
    let pickerDivs = { ldiv: '', rdiv: '' };

    vals.forEach(({ metric, txt, v }, i) => {
        let div;
        if (getChoices('left')[i]) div = 'ldiv';
        else if (getChoices('right')[i]) div = 'rdiv';
        else return;

        if (div) {
            if (typeof v == 'string') {
                //if depth not yet avail == ""

                if (txt == 'Depth') v = v.padEnd(6, '\u00A0');
                if (txt.includes('DDD')) pickerDivs[div] += v;  // dont show the coordinate format,  not needed.
                else pickerDivs[div] += `${txt}:  ${v}`;
            } else {
                let windDir;
                if (txt == 'Wind') {
                    // v is object, of windDir and wind
                    windDir = v.windDir;
                    v = v.wind;
                }
                let m = store.get('metric_' + metric);
                if (txt == 'Depth') m = 'm'; // if undersea,  use meter
                let conversion =
                    m == 'ft' ? e => round(e / ft2m) : W.metrics[metric].conv[m].conversion;
                let valTxt = `${round(10 * conversion(v)) / 10}${m}`;
                if (txt == 'Depth') valTxt = valTxt.padEnd(6, '\u00A0');
                pickerDivs[div] += `${txt}: ${valTxt}`;
                if (txt.includes('Wind')) pickerDivs[div] += `, ${windDir}°`;
            }
            pickerDivs[div] += '<br>';
        }
    });
    if (pickerT.getLeftPlugin() == name) pickerT.fillLeftDiv(pickerDivs.ldiv, true);
    if (pickerT.getRightPlugin() == name) pickerT.fillRightDiv(pickerDivs.rdiv);
    return pickerDivs;
}

/** if showPickerCoordsSelected */
function fillCoordsFields(c) {
    let showPickerCoords = !refs.coordsPicker.classList.contains('checkbox--off');
    if (showPickerCoords) coordsToFields(c);
}

function calculate() {
    if (!wxdata) return;

    let {
        pos: { lat, lon },
        elevation: elev,
    } = wxdata;

    let elevFt = elev / ft2m;

    let lata = abs(lat),
        lati = trunc(lata),
        latm = abs(lata % 1) * 60,
        latmi = trunc(latm),
        lats = abs(latm % 1) * 60,
        NS = sign(lat) == 1 ? 'N' : 'S';
    let lona = abs(lon),
        loni = trunc(lona),
        lonm = abs(lona % 1) * 60,
        lonmi = trunc(lonm),
        lons = abs(lonm % 1) * 60,
        EW = sign(lon) == 1 ? 'E' : 'W';

    let d = wxdata;

    let ix = 0;
    for (let i = 0; i < d.ts.length; i++) {
        if (d.ts[i] > ts) {
            if (i == 0) break;
            else {
                ix = (d.ts[i] - ts) / (d.ts[i] - d.ts[i - 1]) < 0.5 ? i : i - 1;
                break;
            }
        }
    }

    const valid = (d, p) => d[p] && d[p][ix] !== null;
    let p = 'wind_u-surface',
        p2 = 'wind_v-surface';
    let wind = valid(d, p) ? utils.vec2size(d[p][ix], d[p2][ix]) : 'No wind data';
    let windDir = valid(d, p) ? utils.vec2dir(d[p][ix], d[p2][ix]) : 'No windDir data';
    p = 'gust-surface';
    let gust = valid(d, p) ? d[p][ix] : 'No gust data';
    let rainDuration = d['past3hprecip-surface'] === undefined ? 1 : 3;
    p = `past${rainDuration}hprecip-surface`;
    let rain = valid(d, p) ? d[p][ix] * 1000 : 'No rain data';
    p = `past${rainDuration}hconvprecip-surface`;
    let convRain = valid(d, p) ? d[p][ix] * 1000 : 'No convective rain data';
    p = 'cbase-surface';
    let cbase = !valid(d, p) ? 'No cbase data' : d[p][ix] == null ? 'No cloud' : d[p][ix];
    p = 'rh-surface';
    let rh = valid(d, p) ? d[p][ix] : 'No rh data';
    p = 'pressure-surface';
    let pressure = valid(d, p) ? d[p][ix] : 'No pressure data';
    p = 'dewpoint-surface';
    let dewPoint = valid(d, p) ? d[p][ix] : 'No dewPoint data';
    p = 'temp-surface';
    let temp = valid(d, p) ? d[p][ix] : 'No temp data';
    p = 'weatherwarnings-surface';
    let weatherWarnings = valid(d, p) ? d[p][ix] : 'No Wx warnings';

    /** pressureC in hPa */
    let pressureC = round(pressure) / 100;
    let tempC = round((temp + K) * 10) / 10;
    let dewPC = round((dewPoint + K) * 10) / 10;

    let da_corr_dp = dewPC * 20;
    let pa = elevFt + 27 * (1013 - pressureC);
    let isa = 15 - (1.98 * pa) / 1000;
    let da = pa + 118.8 * (tempC - isa);
    let da_dp = da + da_corr_dp;

    // Stull formula
    let wetBulb =
        tempC * atan(0.151977 * sqrt(rh + 8.313659)) +
        atan(tempC + rh) -
        atan(rh - 1.676331) +
        0.00391838 * pow(rh, 1.5) * atan(0.023101 * rh) -
        4.686035 -
        K; // temps in K,   converted later

    let deltaT = temp - wetBulb - K;

    // Steadman formula:
    // vapour pressure e (hPa)
    // e = (RH/100) * 6.105 * exp(17.27*T / (237.7 + T))
    const e_hPa = (rh / 100) * 6.105 * exp((17.27 * tempC) / (237.7 + tempC));
    // Steadman apparent temperature (°C)
    // AT = T + 0.33e - 0.70v - 4.00
    const apparentT = tempC + 0.33 * e_hPa - 0.7 * wind - 4.0 - K; // temps in K,   converted later

    vals.forEach(e => {
        // prettier-ignore
        switch (e.txt) {
                case 'Elev':               e.v = elev;                  break;
                case 'Depth':              e.v = "";                    break; 
                case 'PA':                 e.v = pa*ft2m;               break;
                case 'DA':                 e.v = da*ft2m;               break;
                case 'DA_dp':              e.v = da_dp*ft2m;            break;
                case 'QNH':                e.v = pressure;              break;
                case 'Temp':               e.v = temp;                  break;
                case 'Dew Point':          e.v = dewPoint;              break;
                case 'Wet Bulb':           e.v = wetBulb;               break;
                case '&Delta;T':           e.v = deltaT;                break;
                case 'Apparent T':         e.v = apparentT;             break;
                case 'Humidity':           e.v = rh;                    break;
                case 'Rain':               e.v = rain;                  break;
                case 'Convective rain':    e.v = convRain;              break;
                case 'Cloudbase':          e.v = cbase;                 break;
                case 'Wind':               e.v = {wind, windDir};       break;
                case 'Gust':               e.v = gust;                  break;
                case `DDD°MM'SS.S"`:       e.v = `${lati}°${latmi}'${lats.toFixed(1)}"${NS} ${loni}°${lonmi}'${lons.toFixed(1)}"${EW}`;     break; 
                case `DDD°MM.MMM'`:        e.v = `${lati}°${latm.toFixed(3)}'${NS} ${loni}°${lonm.toFixed(3)}'${EW}`;                       break;  
                case `DDD.DDDDD°`:         e.v = `${lata.toFixed(5)}°${NS} ${lona.toFixed(5)}°${EW}`;                                       break;   
            }
    });

    let data = { vals, coords: { lat, lon } };
    postData(JSON.stringify(data));
    makePickerTextAndFill(vals);
    if (elev == 0 && isChoiceSelected('Depth')) getBathymetry({ lat, lon });
}

function getBathymetry(c) {
    bathyReqTime = Date.now();
    let thisReqTime = bathyReqTime;
    let url = `https://www.flymap.co.za/srtm30/elev.php?lat=${c.lat}&lng=${c.lng || c.lon}`;

    fetch(url, {
        method: 'GET',
    })
        .then(r => r.json())
        .then(r => {
            if (bathyReqTime > thisReqTime) return; // waiting for more recent Req,  prevent flickering
            let pickerPos = {
                lat: pickerT._latlng.lat,
                lon: pickerT._latlng.lng || pickerT._latlng.lon,
            };
            if (abs(c.lat - pickerPos.lat < 0.1 && abs(c.lon - pickerPos.lon) < 0.1)) {
                vals.find(e => e.txt == 'Depth').v = r[0];
                let data = { vals, coords: pickerPos };
                postData(JSON.stringify(data));
                makePickerTextAndFill(vals);
            }
        })
        .catch(er => {
            log('err', er);
            log('DEPTH NOT FOUND,  use 0');
        });
}

function fetchData(c) {
    if (c.otherTab) {
        return;
    }
    if (c.source == 'picker') return; // only react on custom-picker

    lastpos = c;
    //  c.model = prod;

    c.interpolate = true;
    c.step = 1;

    let product = store.get('product');
    if (product == 'topoMap') product = 'ecmwf';
    c.model = product;

    wxdata = { pos: c };

    Promise.all([
        //windyFetch.getPointForecastData(product, c).catch(e => log(e)),
        windyFetch.getElevation(c.lat, c.lng || c.lon),
        fetch('https://api.windy.com/api/point-forecast/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${W.store.get('userToken')}`,
            },
            body: JSON.stringify({
                parameters,
                lat: c.lat,
                lon: c.lon,
                model: product,
                levels: [levels[0]],
                key: 'RddPLnCXRuZ3s3Kb5J5G3QnTMToRNxnd',
                step: c.step,
            }),
        })
            .then(response => response.json())
            .then(d => {
                if (
                    d.error == 'Bad Request' &&
                    d.message[0].includes('Invalid parameters provided')
                ) {
                    parameters = d.message[0].match(/\[(.*)\]/)[1].split(/\s*,\s*/);
                    fetchData(c);
                    return null;
                }
                return d;
            }),
    ]).then(async ([data1, data2]) => {
        if (data2 == null) {
            log('error with point forecast api,  get correct parameters');
            return;
        }
        wxdata.elevation = data1.data;

        //not using modelElevation at the moment
        /*
        if (data1) {
            wxdata.elevation = data1.data.header.elevation;
            wxdata.modelElevation = data1.data.header.elevation;
        } else {
            log('error with getPointForecastData,  elev not avail');
            let elev = await windyFetch.getElevation(c.lat, c.lng || c.lon);
            wxdata.elevation = elev.data;
        }
        */
        for (let d in data2) {
            wxdata[d] = data2[d];
        }

        //setTimeout(() => (datafnd = true), 150);
        calculate();
    });
    //}
    fillCoordsFields(c);
}

export { vals, settings, makePickerTextAndFill, fillCoordsFields };
