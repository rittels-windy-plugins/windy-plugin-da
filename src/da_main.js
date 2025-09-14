console.log('RUNNING DA');

import utils from '@windy/utils';
import { map } from '@windy/map';
import store from '@windy/store';
import bcast from '@windy/broadcast';
import { emitter as picker } from '@windy/picker';
import http from '@windy/http';
//import rs from '@windy/rootScope';
import windyFetch from '@windy/fetch';
import interpolator from '@windy/interpolator';
import loc from '@windy/location';

import * as singleclick from '@windy/singleclick';

import config from './pluginConfig';

import { insertGlobalCss, removeGlobalCss } from './globalCss.js';

import { getPickerMarker } from 'custom-windy-picker';

const { name } = config;
const { $, getRefs } = utils;

const { log } = console;

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

    ({ node } = plgn.window);
    ({ refs } = getRefs(node));

    // important to close picker
    bcast.fire('rqstClose', 'picker');

    //??? should I open my picker if windy picker was open

    pickerT = getPickerMarker();

    // add[Right|Left]Plugin is done by focus

    // todo move this to svelte later
    let choices = getChoices();
    for (let c = refs.choose.children, i = 0; i < c.length; i++) {
        c[i].classList[choices[i] == 0 ? 'add' : 'remove']('checkbox--off');
    }
    refs.choose.addEventListener('click', onChoose);

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

let nVals = 10;

let ts = Date.now();

store.insert('plugin-da-selected-vals', {
    def: 480,
    allowed: v => v >= 0 && v < Math.pow(2, nVals),
    save: true,
});

function getChoices() {
    let sv = store.get('plugin-da-selected-vals');
    if (!(sv || sv === 0)) return Array(10).fill(0).fill(1, 0, 4);
    let choices = ('0000000000000' + store.get('plugin-da-selected-vals').toString(2))
        .slice(-nVals)
        .split('')
        .map(Number);
    return choices;
}

export const onopen = params => {
    if (params && params.query) {
        console.log(params);
        query = params.query;
        useQuery(query);
    }
};

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

function readChoices(lastClick) {
    let choices = [...refs.choose.children].map(e => !e.classList.contains('checkbox--off'));
    if (choices.filter(e => e).length > 5) {
        let i;
        for (i = choices.length - 1; i > 0 && (choices[i] == false || i == lastClick); i--);
        choices[i] = false;
        [...refs.choose.children][i].classList.add('checkbox--off');
    }

    store.set('plugin-da-selected-vals', parseInt(choices.map(Number).join(''), 2));
}

function onChoose(e) {
    let tg = e.target;
    let ix;
    if (tg.classList.contains('checkbox')) {
        tg.classList.toggle('checkbox--off');
        if (!tg.classList.contains('checkbox--off'))
            ix = [...refs.choose.children].findIndex(e => tg == e);
    }
    readChoices(ix);
    calculate();
}

function calculate() {
    if (wxdata) {
        elevPntFcst = wxdata.data.header.elevation;

        let elev = Math.round(elp.elev * 3.28084);
        if (elev < 0) elev = 0;

        let d = wxdata.data.data;
        console.log(d);
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
        let wind = d.wind[ix],
            gust = d.gust[ix],
            windDir = d.windDir[ix],
            rain = d.rain[ix],
            cbase = d.cbase[ix],
            rh = d.rh[ix],
            pressure = d.pressure[ix],
            dewPoint = d.dewPoint[ix],
            temp = d.temp[ix];
        //weathercode = d.weathercode[ix];

        let pressureC = Math.round(pressure) / 100;
        let tempC = Math.round((temp + K) * 10) / 10;
        let dewPC = Math.round((dewPoint + K) * 10) / 10;
        let da_corr_dp = dewPC * 20;

        let wetBulb =
            tempC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
            Math.atan(tempC + rh) -
            Math.atan(rh - 1.676331) +
            0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
            4.686035 -
            K;

        let deltaT = temp - wetBulb - K;

        let vals = [
            { metric: 'pressure', txt: 'QNH: ', v: pressure },
            { metric: 'temp', txt: 'Temp: ', v: temp },
            { metric: 'temp', txt: 'Dew Point: ', v: dewPoint },
            { metric: 'temp', txt: 'Wet Bulb: ', v: wetBulb },
            { metric: 'temp', txt: '&Delta;T: ', v: deltaT },
            { metric: 'rh', txt: 'Humidity: ', v: rh },
            { metric: 'rain', txt: 'Rain: ', v: rain },
            { metric: 'altitude', txt: 'Cloudbase: ', v: cbase },
            // { metric: '', txt: 'Wx code: ' },
            { metric: 'wind', txt: 'Wind: ', v: wind },
            { metric: 'wind', txt: 'Gust: ', v: gust },
        ];

        let pa = elev + 27 * (1013 - pressureC);
        let isa = 15 - (1.98 * pa) / 1000;
        let da = pa + 118.8 * (tempC - isa);
        let da_dp = da + da_corr_dp;

        let thermalspan =
            thermal && elp.elev !== void 0
                ? `<span style="width:60px;font-size:16px;display:inline-block;margin-bottom:5px;">&nbsp;${Math.round(thermal - elev)} AGL</span><br>`
                : '';

        let ldiv = '';
        let choices = getChoices();
        vals.forEach(({ metric, txt, v }, i) => {
            if (!choices[i]) return;
            /*
            if (txt.includes('Wx code')) {
                ldiv += 'Wx code: ' + parseWxCode(weathercode) + '<br>';
                return;
            }
                */
            let m = store.get('metric_' + metric);
            ldiv += `${txt} ${Math.round(W.metrics[metric].conv[m].conversion(v))}${m}`;
            if (txt.includes('Wind')) ldiv += `, ${windDir}°`;
            ldiv += '<br>';
        });

        if (pickerT.getLeftPlugin() == name)
            pickerT.fillLeftDiv(ldiv, true, { 'flex-basis': '50%' });
        //pickerT.showLeftDiv();

        if (pickerT.getRightPlugin() == name)
            pickerT.fillRightDiv(
                `
        <div>
            ${thermalspan}
            <span style="width:45px;display:inline-block;">${elp.elev > 0 ? 'Elev:' : 'Depth'}</span>${
                elp.elev > 0 ? elev + '&nbspft' : Math.round(elp.elev) + '&nbspm'
            }<br>
            <span style="width:45px;display:inline-block;">PA:</span>${Math.round(pa)}&nbspft<br>
            <span style="width:45px;display:inline-block;">DA:</span>${Math.round(da)}&nbspft<br>
            <span style="color:white">
            <span style="width:45px;display:inline-block;">DA_dp:</span>${Math.round(da_dp)}&nbspft
            </span>
        <div>`,
                { 'flex-basis': '50%' },
            );
        //pickerT.showRightDiv();
        //setURL();
    }
}

function fetchData(c) {
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
                log('WINDY ELEV', data);
                return data;
            })

            .then(r => {
                elp.elev = r; //[0];
                elp.pos = c;
                setTimeout(() => (elevfnd = true), 100);
                righta = 1;
                if (r == 0) {                    //if over sea,  try to find depth
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
        windyFetch
            .getPointForecastData(product, c)
            .then(data => {
                console.log(data);
                wxdata = data;
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
}
