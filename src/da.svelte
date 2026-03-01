<div class="embed-window">
    <span
        class="checkbox"
        class:checkbox--off={!thisPlugin.isFocused}
        style="position:relative; top:0.1em"
        data-tooltip={`Picker focuses on the ${title} plugin.`}
        on:click={focus}>&nbsp;</span
    >
    <span
        on:click={() => {
            showInfo(name);
            focus(); // not sure,  but seems to make sense intuitively
        }}
        style:cursor="pointer">Show Multipicker settings</span
    >
    <div data-ref="messageDiv" class="hidden"></div>
</div>

<div bind:this={mainDiv} id={`${name}-info`} class="bg-transparent dark-content">
    <div
        class="closing-x"
        on:click={() => {
            document.body.classList.remove(`on${name}-info`);
        }}
    ></div>
    <div bind:this={cornerHandle} data-ref="cornerHandle" class="corner-handle"></div>
    <div bind:this={cornerHandleTop} data-ref="cornerHandleTop" class="corner-handle-top"></div>

    <div class="flex-container">
        <div class="plugin__title">Multipicker</div>
        <div class="scrollable">
            <div class="toggle-section checkbox off" on:click={toggleSection}>
                Choose what to display in the picker:
            </div>
            <div class="section">
                <table style="margin-bottom:5px">
                    <tr><td>Left</td><td>Right</td></tr>
                </table>
                <table data-ref="choose">
                    {#each vals as val}
                        <tr>
                            <td><div class="left checkbox"></div></td>
                            <td><div class="right checkbox"></div></td>
                            <td style="text-align: left;">
                                <div>
                                    {@html val.menu || val.txt}
                                </div>
                            </td>
                        </tr>
                    {/each}
                </table>
            </div>
            <div class="toggle-section checkbox off" on:click={toggleSection}>Select Location:</div>
            <div class="section">
                <div class="sign-row">
                    {#each [...'NSEW'] as s}
                        <div
                            class="NSEW"
                            class:selected={svelteCoordSign[s].selected}
                            on:click={changeSign}
                            bind:this={svelteCoordSign[s].el}
                        >
                            {s}
                        </div>
                    {/each}
                </div>
                <div class="coordsTable">
                    {#each Object.keys(coords).sort((a, b) => b.length - a.length) as key}
                        <div class="dms loc-row">
                            {#each ['lt', 'ln'] as ltln}
                                <div>
                                    {#each coords[key][ltln] as field, i}
                                        <input
                                            class="field"
                                            data-ref={ltln + key + i}
                                            type="text"
                                            bind:this={svelteCoords[key][ltln][i].el}
                                            on:input={handleCoordsInput}
                                            on:keydown|stopPropagation={() => {}}
                                        />
                                    {/each}
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>
                <div
                    data-ref="placePicker"
                    class="button button--secondary"
                    on:click={() => placePicker(marker)}
                >
                    Place picker
                </div>
                <br />
                <div
                    data-ref="paste"
                    class="button button--secondary"
                    on:click={() => {
                        navigator.clipboard.readText().then(s => {
                            let latlon = stringToLatLon(s);
                            if (latlon == 'invalid') return;
                            if (latlon.length !== 2) return;
                            coordsToFields(latlon);
                        });
                    }}
                >
                    Paste coordinates from clipboard
                </div>
                <br />

                <div
                    data-ref="coordsPicker"
                    class="checkbox"
                    on:click={e => {
                        e.currentTarget.classList.toggle('checkbox--off');
                    }}
                >
                    Show coords of the picker
                </div>
            </div>

            <div class="toggle-section checkbox off" on:click={toggleSection}>
                Change Picker settings:
            </div>
            <div class="section">
                <div class="checkbox" data-ref="togglePickerElevation">
                    Show elevetion in picker.
                </div>
                <div class="checkbox" data-ref="togglePickerCoordinates">
                    Show coordinates below picker.
                </div>
            </div>
            <div class="toggle-section checkbox off" on:click={toggleSection}>About:</div>
            <div class="section">
                <a href="https://rittels-windy-plugins.github.io?multipicker"
                    ><u>https://rittels-windy-plugins.github.io?multipicker</u></a
                >
            </div>
        </div>
        <Footer onFooterClick={open => {}} />
    </div>
</div>

<script lang="ts">
    // @ts-nocheck

    import { onDestroy, onMount } from 'svelte';
    import plugins from '@windy/plugins';
    import { map } from '@windy/map';
    import store from '@windy/store';

    import { init, closeCompletely, vals } from './da_main.js';
    import {
        coords,
        coordSign,
        changeSign,
        handleCoordsInput,
        placePicker,
        coordsToFields,
        stringToLatLon,
    } from './coordinates.js';
    import {
        addDrag,
        showInfo,
        getWrapDiv,
        makeBottomRightHandle,
        makeTopLeftHandle,
        embedForTablet,
    } from './utils/infoWinUtils.js';
    import { getPickerMarker } from 'custom-windy-picker';
    import Footer from './utils/Footer.svelte';

    import config from './pluginConfig.js';
    const { title, name } = config;

    const { log } = console;

    const thisPlugin = plugins[name];

    let svelteCoords = coords,
        svelteCoordSign = coordSign;
    console.log(svelteCoordSign);
    let node;
    let mainDiv;
    let cornerHandle, cornerHandleTop;
    let closeButtonClicked;
    let marker;

    function focus() {
        for (let p in plugins) {
            if (p.includes('windy-plugin') && p !== name && plugins[p].defocus) {
                plugins[p].defocus();
            }
        }
        thisPlugin.isFocused = true;

        // now do whatever,  for this plugin,  only addRightPlugin and addLeftPlugin ;
        marker = getPickerMarker();
        marker?.addRightPlugin(name);
        marker?.addLeftPlugin(name);
        if (marker?.getParams()) {
            marker.openMarker(marker.getParams());
        }
    }

    function defocus() {
        thisPlugin.isFocused = false;
    }

    onMount(() => {
        try {
            init(thisPlugin);
            node = document.getElementById('plugin-' + thisPlugin.ident);

            const wrapDiv = getWrapDiv();
            wrapDiv.appendChild(mainDiv);

            makeBottomRightHandle(cornerHandle, mainDiv);
            makeTopLeftHandle(cornerHandleTop, mainDiv);
            //embedForTablet(thisPlugin);

            //// this should not be needed later
            node.querySelector(':scope > .closing-x').addEventListener(
                'click',
                () => (closeButtonClicked = true),
            );
            //

            focus();
            thisPlugin.focus = focus;
            thisPlugin.defocus = defocus;
            throw new Error('mounted');
        } catch (e) {
            W.errorLogger.sentErrors.push({ msg: e.message, stack: e.stack });
        }
    });

    export const onopen = _params => {
        if (_params && 'lon' in _params && !isNaN(_params.lat) && !isNaN(_params.lon)) {
            // not sure if needed?  Maybe onopen may happen before mount
            marker = getPickerMarker();
            marker.openMarker(_params);
            map.setView(_params);
        }
    };

    onDestroy(() => {
        mainDiv.remove();
        document.body.classList.remove(`on${name}-info`);

        //// this should not be needed later,   whole plugin can then be moved into svelte,  open() requires an object
        if (!closeButtonClicked) setTimeout(() => thisPlugin.open({}));
        else closeCompletely();
        ////
    });

    function toggleSection(e) {
        e.target.classList.toggle('off');
        let str = [...mainDiv.querySelectorAll('.toggle-section')]
            .map(e => (e.classList.contains('off') ? 1 : 0))
            .join('');
        store.set('plugin-da-sections', parseInt(str, 2));
    }
</script>

<style lang="less">
    @import 'da.less?1772385396995';
</style>
