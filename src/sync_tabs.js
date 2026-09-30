import { map } from '@windy/map';
import store from '@windy/store';
import { $, throttle } from '@windy/utils';
import { emitter as picker } from '@windy/picker';
import { getPickerMarker } from 'custom-windy-picker';
import { makePickerTextAndFill, fillCoordsFields, settings } from './da_main.js';

const { log } = console;

let pickerT;

let tabId = null, // will get a value when mounted
    pickerByOtherTab = false,
    channel;

let TO;
let params = ['timestamp', 'map', 'level', 'overlay', 'model'];
let postParamsFuns = {};

let otherTab = {};

function setView(c, z) {
    map.setView(c, z);
}

let throttledSW = throttle(setView, 50);

function initSyncTabs() {
    if (tabId == null) tabId = Math.round(Math.random() * 1000000000); // do not reassign tab number,  only if cloased completely.
    pickerT = getPickerMarker();
    for (let p of params) {
        otherTab[p] = false;
    }

    channel = new BroadcastChannel('channel');
    channel.onmessage = e => {
        if (e.data.tabId == tabId) return;
        for (let p of params) {
            if (e.data[p] !== undefined && settings['sync' + p]) {
                otherTab[p] = true;
                clearTimeout(TO);
                TO = setTimeout(() => (otherTab[p] = false), 500);
                if (p == 'map') {
                    throttledSW(e.data.map.center, e.data.map.zoom);
                } else {
                    store.set(p, e.data[p]);
                }
            }
        }
        if (settings.syncPickers) {
            if (e.data.coords !== undefined) {
                pickerByOtherTab = true;
                let { coords } = e.data;
                coords.otherTab = true;
                pickerT.openMarker(coords);
                setTimeout(() => (pickerByOtherTab = false), 500);
            }
            if (e.data.data !== undefined) {
                let data = JSON.parse(e.data.data);
                makePickerTextAndFill(data.vals);
                fillCoordsFields(data.coords);
            }
        }
    };
}

function postParams(p) {
    if (!settings['sync' + p] || otherTab[p]) return;
    if (p == 'map') {
        let zoom = map.getZoom();
        let center = map.getCenter();
        channel.postMessage({ tabId, map: { zoom, center } });
    } else channel.postMessage({ tabId, [p]: store.get(p) });
}

function postPicker(coords) {
    // for now,  only post if custom-picker is moved.   This is important for tablet when mobile picker can trigger pickerMoved
    if (coords.source !== 'custom-picker') return;
    if (pickerByOtherTab) return;
    channel.postMessage({ tabId, coords });
}

function postData(data) {
    if (pickerByOtherTab || !settings.syncPickers) return;
    channel.postMessage({ tabId, data });
}

function toggleSync(p, sync) {
    if (tabId == null) return;
    settings['sync' + p] = sync;
    if (sync) postParamsFuns[p] = postParams.bind(0, p);
    if (p == 'map') map[sync ? 'on' : 'off']('move', postParamsFuns[p]);
    else store[sync ? 'on' : 'off'](p, postParamsFuns[p]);
}

function toggleSyncPickers(syncPickers) {
    if (tabId == null) return;
    settings.syncPickers = syncPickers;
    if (syncPickers) {
        pickerT.onDrag(postPicker);
        picker.on('pickerOpened', postPicker);
        picker.on('pickerMoved', postPicker);
    } else {
        pickerByOtherTab = false;
        pickerT.offDrag(postPicker);
        picker.off('pickerOpened', postPicker);
        picker.off('pickerMoved', postPicker);
    }
}

function cleanupSync() {
    channel.close();
    params.forEach(p => toggleSync(p, false));
    toggleSyncPickers(false);
    tabId = null;
}

export { initSyncTabs, cleanupSync, toggleSyncPickers, toggleSync, postData };
