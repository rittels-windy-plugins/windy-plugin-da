import { map } from '@windy/map';
import store from '@windy/store';
import { $ } from '@windy/utils';
import { emitter as picker } from '@windy/picker';
import { getPickerMarker } from 'custom-windy-picker';
import { makePickerTextAndFill, fillCoordsFields, settings } from './da_main.js';

const { log } = console;

let pickerT;

let tabId = null, // will get a value when mounted
    channel,
    channelPicker,
    channelData,
    mapByOtherTab = false,
    pickerByOtherTab = false;

function initSyncTabs() {
    if (tabId == null) tabId = Math.round(Math.random() * 1000000000); // do not reassign tab number,  only if cloased completely.
    pickerT = getPickerMarker();
}

function postParams() {
    if (mapByOtherTab) {
        return;
    }
    let ts = store.get('timestamp');
    let zoom = map.getZoom();
    let center = map.getCenter();

    channel.postMessage({ tabId, ts, zoom, center });
}

function postPicker(coords) {
    // for now,  only post if custom-picker is moved.   This is important for tablet when mobile picker can trigger pickerMoved
    if (coords.source !== 'custom-picker') return;
    if (pickerByOtherTab) return;
    channelPicker.postMessage({ tabId, coords });
}

function postData(data) {
    if (pickerByOtherTab || !settings.syncPickers) return;
    channelData.postMessage({ tabId, data });
}

function receiveData(data, fun) {}

function toggleSyncTabs(syncTabs) {
    if (tabId == null) return;
    settings.syncTabs = syncTabs;
    if (syncTabs) {
        channel = new BroadcastChannel('syncMapParams');
        channel.onmessage = e => {
            if (e.data.tabId !== tabId) {
                mapByOtherTab = true;
                store.set('timestamp', e.data.ts);
                map.setView(e.data.center, e.data.zoom);
                setTimeout(() => (mapByOtherTab = false), 500);
            }
        };
        store.on('timestamp', postParams);
        map.on('move', postParams);
    } else {
        if (channel) channel.close();
        mapByOtherTab = false;
        store.off('timestamp', postParams);
        map.off('move', postParams);
    }
}

function toggleSyncPickers(syncPickers) {
    if (tabId == null) return;
    settings.syncPickers = syncPickers;
    if (syncPickers) {
        channelPicker = new BroadcastChannel('syncPickers');
        channelPicker.onmessage = e => {
            if (e.data.tabId !== tabId) {
                pickerByOtherTab = true;
                let { coords } = e.data;
                coords.otherTab = true;
                pickerT.openMarker(coords);
                setTimeout(() => (pickerByOtherTab = false), 500);
            }
        };
        channelData = new BroadcastChannel('pickerData');
        channelData.onmessage = e => {
            if (e.data.tabId !== tabId) {
                let data = JSON.parse(e.data.data);
                makePickerTextAndFill(data.vals);
                fillCoordsFields(data.coords);
            }
        };
        pickerT.onDrag(postPicker);
        picker.on('pickerOpened', postPicker);
        picker.on('pickerMoved', postPicker);
    } else {
        if (channelPicker) channelPicker.close();
        if (channelData) channelData.close();
        pickerByOtherTab = false;
        pickerT.offDrag(postPicker);
        picker.off('pickerOpened', postPicker);
        picker.off('pickerMoved', postPicker);
    }
}

function toggleHideMenu(hideMenu) {
    if (tabId == null) return;
    if (hideMenu) {
        $('[data-plugin="rhbottom"]').classList.add('hidden');
        $('[data-plugin="rhpane-top"]').classList.add('hidden');
        $('#search').classList.add('hidden');
    } else {
        $('[data-plugin="rhbottom"]').classList.remove('hidden');
        $('[data-plugin="rhpane-top"]').classList.remove('hidden');
        $('#search').classList.remove('hidden');
    }
}

function cleanupSync() {
    toggleHideMenu(false);
    toggleSyncPickers(false);
    toggleHideMenu(false);
    tabId = null;
}

export { initSyncTabs, cleanupSync, toggleHideMenu, toggleSyncPickers, toggleSyncTabs, postData };
