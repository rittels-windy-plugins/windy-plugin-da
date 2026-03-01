import utils from '@windy/utils';
import { map } from '@windy/map';
import store from '@windy/store';
import bcast from '@windy/broadcast';
import { emitter as picker } from '@windy/picker';
import http from '@windy/http';
//import rs from '@windy/rootScope';
import windyFetch from '@windy/fetch';
//import interpolator from '@windy/interpolator';
import loc from '@windy/location';
import geoloc from '@windy/geolocation';

import * as singleclick from '@windy/singleclick';

import config from './pluginConfig';

import { insertGlobalCss, removeGlobalCss } from './globalCss.js';
import { getPickerMarker } from 'custom-windy-picker';
import { coordsToFields } from './coordinates.js';

const { name } = config;
const { $, getRefs } = utils;

const { log } = console;
const { round, pow, atan, sqrt, abs, trunc, sign, exp } = Math;

const ft2m = 0.3048;

let thisPlugin, refs, node;

let hasHooks;
let pickerT;

let loggerTO;
function logMessage(msg) {
    if (!store.get('consent').analytics) return;
    fetch(`https://www.flymap.org.za/windy-logger/logger.htm?name=${name}&message=${msg}`, {
        cache: 'no-store',
    }).then(console.log);
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

    let headings = (+store.get('plugin-da-sections')).toString(2).padStart(4, '0');
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

    pickerT.onDrag(fetchData);
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

//

//let pressure, temp, dewP, rh, pa, da, da_corr_dp, da_dp;
let wxdata;
let prod = 'ecmwf';
let lastpos;
let lefta = 1,
    righta = 1;
let elp = {};
let datafnd = true,
    elevfnd = true,
    airfnd = true;
let thermal;
let query;

/** elevation from point forecast */
let elevPntFcst;

const K = -273.15;

let ts = Date.now();

let vals = [
    { metric: 'altitude', txt: 'Elev' },
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
    def: parseInt('1100', 2),
    allowed: v => v >= 0 && v < pow(2, 4),
    save: true,
});

function getChoices(side) {
    let sv = store.get('plugin-da-selected-vals-' + side);
    let choices = sv.toString(2).padStart(nVals, '0').split('').map(Number);
    return choices;
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
    elevfnd = datafnd = true;
    setTimeout(fetchData, 500, e);
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

function calculate() {
    console.log(wxdata);
    /*
    pickerT.fillRightDiv(
        'WX ' + JSON.stringify(wxdata) + '<br>' + 'ts' + ts + '<br>' + wxdata.data.data.temp[0],
    );
    */
    if (!wxdata) {
        //if (pickerT.getRightPlugin() == name)
        //    pickerT.fillRightDiv(
        //        "No Wx Data"
        //    );
    }
    if (wxdata) {
        elevPntFcst = wxdata.data.header.elevation;

        let {
            pos: { lat, lon },
        } = wxdata;

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

        let elev = elp.elev / ft2m;
        if (elev < 0) elev = 0;

        let d = wxdata.data.data;
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

        pickerT.fillRightDiv('ix ' + ix);

        pickerT.fillRightDiv(d.wind[ix]);

        let wind = d.wind[ix];

        
        let gust = d.gust[ix];
        let windDir = d.windDir[ix];
        let rain = d.rain[ix];
        let cbase = d.cbase[ix];

        pickerT.fillRightDiv('cbs  ' + cbase);
        let rh = d.rh[ix],
            pressure = d.pressure[ix],
            dewPoint = d.dewPoint[ix],
            temp = d.temp[ix];
        //weathercode = d.weathercode[ix];

        pickerT.fillRightDiv('wind ' + d.wind[ix]);

        /** pressureC in hPa */
        let pressureC = round(pressure) / 100;
        let tempC = round((temp + K) * 10) / 10;
        let dewPC = round((dewPoint + K) * 10) / 10;

        let da_corr_dp = dewPC * 20;
        let pa = elev + 27 * (1013 - pressureC);
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
                case 'Elev':               e.v = elp.elev;        break;
                case 'PA':                 e.v = pa*ft2m;         break;
                case 'DA':                 e.v = da*ft2m;         break;
                case 'DA_dp':              e.v = da_dp*ft2m;      break;
                case 'QNH':                e.v = pressure;        break;
                case 'Temp':               e.v = temp;            break;
                case 'Dew Point':          e.v = dewPoint;        break;
                case 'Wet Bulb':           e.v = wetBulb;         break;
                case '&Delta;T':           e.v = deltaT;          break;
                case 'Apparent T':         e.v = apparentT;       break;
                case 'Humidity':           e.v = rh;              break;
                case 'Rain':               e.v = rain;            break;
                case 'Cloudbase':          e.v = cbase;           break;
                case 'Wind':               e.v = wind;            break;
                case 'Gust':               e.v = gust;            break;
                case `DDD°MM'SS.S"`:       e.v = `${lati}°${latmi}'${lats.toFixed(1)}"${NS} ${loni}°${lonmi}'${lons.toFixed(1)}"${EW}`;  break; 
                case `DDD°MM.MMM'`:        e.v = `${lati}°${latm.toFixed(3)}'${NS} ${loni}°${lonm.toFixed(3)}'${EW}`;  break;  
                case `DDD.DDDDD°`:         e.v = `${lata.toFixed(5)}°${NS} ${lona.toFixed(5)}°${EW}`;  break;   
            }
        });

        let thermalspan =
            thermal && elp.elev !== void 0
                ? `<span style="width:60px;font-size:16px;display:inline-block;margin-bottom:5px;">&nbsp;${round(thermal - elev)} AGL</span><br>`
                : '';

        let pickerDivs = { ldiv: 'left<br>', rdiv: 'right<br>' };
        pickerT.fillRightDiv('right  ' + pickerDivs.rdiv);

        /*
        vals.forEach(({ metric, txt, v }, i) => {
            let div;
            if (getChoices('left')[i]) div = 'ldiv';
            else if (getChoices('right')[i]) div = 'rdiv';
            else return;

            if (div) {
                if (typeof v == 'string') pickerDivs[div] += v;
                else {
                    let m = store.get('metric_' + metric);
                    if (txt == 'Elev' && m == 'ft' && v < 0) m = 'm'; // if undersea,  use meter
                    let conversion =
                        m == 'ft' ? e => round(e / ft2m) : W.metrics[metric].conv[m].conversion;
                    pickerDivs[div] += `${txt}:  ${round(conversion(v))}${m}`;
                    if (txt.includes('Wind')) pickerDivs[div] += `, ${windDir}°`;
                }
                pickerDivs[div] += '<br>';
            }
        });
        */

        if (pickerT.getLeftPlugin() == name) pickerT.fillLeftDiv(pickerDivs.ldiv, true);
        //pickerT.showLeftDiv();

        if (pickerT.getRightPlugin() == name) pickerT.fillRightDiv(pickerDivs.rdiv);
        //pickerT.showRightDiv();
        //setURL();
    }
}

function fetchData(c) {
    console.error('SOURCE', c, JSON.stringify(c, null, 1));
    //pickerT.fillLeftDiv(JSON.stringify(c, null, 1), true);
    if (c.source == 'picker') return; // only react on custom-picker

    lastpos = c;
    //  c.model = prod;
    lefta -= 0.05;
    righta -= 0.05;
    if (lefta < 0.6) lefta = 0.6;
    if (righta < 0.6) righta = 0.6;
    if ($('#picker-div-left')) $('#picker-div-left').style.color = `rgba(255,255,255,${lefta})`;
    if ($('#picker-div-right')) $('#picker-div-right').style.color = `rgba(255,255,255,${righta})`;
    if (elevfnd) {
        elevfnd = false;
        http.get(`services/elevation/${c.lat}/${c.lng || c.lon}`)
            .then(({ data }) => {
                return data;
            })

            .then(r => {
                elp.elev = r; //[0];
                elp.pos = c;
                setTimeout(() => (elevfnd = true), 100);
                righta = 1;
                if (r == 0) {
                    //if over sea,  try to find depth
                    fetch(
                        `https://www.flymap.co.za/srtm30/elev.php?lat=${c.lat}&lng=${c.lng || c.lon}`,
                        { method: 'GET' },
                    )
                        .then(r => r.json())
                        .then(r => {
                            elp.elev = r[0];
                            calculate();
                        })
                        .catch(er => {
                            log('DEPTH NOT FOUND,  use 0');
                            calculate();
                        });
                } else {
                    calculate();
                }
            })
            .catch(er => {
                console.log(er);
                elevfnd = true;
            });
    }

    /*
    if (store.get('overlay') == 'ccl') {
        interpolator(ip => {
            thermal = ip(c)[0] * 3.28084;
            console.log('thermal', thermal);
        });
    } else thermal = null;
*/

    if (datafnd) {
        datafnd = false;
        c.interpolate = true;
        c.step = 1;
        let product = store.get('product');
        if (product == 'topoMap') product = 'ecmwf';
        //pickerT.fillRightDiv('fetching', true);
        windyFetch
            .getPointForecastData(product, c)
            .then(data => {
                wxdata = data;
                //pickerT.fillRightDiv(JSON.stringify(data, null, 1), true);
                wxdata.pos = c;
                lefta = 1;
                setTimeout(() => (datafnd = true), 150);
                calculate();
            })
            .catch(er => {
                console.log(er);
                datafnd = true;
            });

        /*    
        windyFetch.getMeteogramForecastData(store.get('product'), c)
            .then(data => {
                console.log(data);
            })
            .catch(er => {
                console.log(er);
            });
        */
    }

    let showPickerCoords = !refs.coordsPicker.classList.contains('checkbox--off');
    if (showPickerCoords) coordsToFields(c);
}

export { vals };
