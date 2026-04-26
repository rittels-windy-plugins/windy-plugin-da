import { $ } from '@windy/utils';
import { map } from '@windy/map';
import { cityLabels } from '@windy/cityLabels';
import { settings } from './da_main.js';

const { log } = console;
let inited = false;

function initOther() {
    inited = true;
}

function toggleHideMenu(hideMenu) {
    if (!inited) return;
    settings.hideMenu = hideMenu;
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

function toggleHideLabels(hideLabels) {
   
    if (!inited) return;
    settings.hideLabels = hideLabels;
    if (hideLabels) {
        if (map.hasLayer(cityLabels)) cityLabels.remove();
    } else {
        cityLabels.addTo(map); // doesnt matter if added more than once
    }
}

function cleanupOther() {
    toggleHideLabels(false);
    toggleHideMenu(false);
    inited = false; // not sure if needed,  but may be reopened later,  then has to be reinited.
}

export { initOther, cleanupOther, toggleHideMenu, toggleHideLabels };
