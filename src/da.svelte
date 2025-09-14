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
        style:cursor="pointer">Show density altitude settings</span
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
        <div class="plugin__title">Elevation, Density Altitude and Multipicker</div>
        <div class="scrollable">
            <div>
                <br />
                Shows elevation at picker position.<br /><br />
                The temperature, pressure (QNH) and dew point are loaded for the picker position.<br
                />
                <br />
                The pressure altitude (PA), density altitude (DA) and DA corrected for dew point(DA_dp)
                are then calculated.<br /><br />
                Elevation is obtained from the Windy server,  and bathymetry  (1km resolution) from:
                <a style="font-size:0.8em" href=" https://topex.ucsd.edu/WWW_html/srtm30_plus.html"
                    ><u>https://topex.ucsd.edu/WWW_html/srtm30_plus.html</u></a
                ><br /><br />
                Calculations:<br /><br />
                &nbsp;&nbsp;PA = elev + 27 x (1013-QNH)<br />
                &nbsp;&nbsp;DA = PA + 118.8 x (temp-ISA)<br />
                &nbsp;&nbsp;where ISA = 15 - 1.98 x PA/1000<br />
                &nbsp;&nbsp;DA_dp = DA + 20 x Dew Point<br /><br />
                <span style="font-size:8px">https://en.wikipedia.org/wiki/Density_altitude</span>
            </div>
            <br /><br />
            <div>
                <div class="header">
                    Choose what to display on the left side of the picker (max&nbsp5):
                </div>
                <div data-ref="choose">
                    <div class="checkbox">QNH</div>
                    <div class="checkbox">Temp</div>
                    <div class="checkbox">Dew point</div>
                    <div class="checkbox">Wet bulb (Calculated from Stull formula)</div>
                    <div class="checkbox">&Delta;T = Temp - Wet bulb</div>
                    <div class="checkbox">Humidity</div>
                    <div class="checkbox">Rain</div>
                    <div class="checkbox checkbox--off">Cloudbase</div>
                    <!--<div class="checkbox checkbox--off">Wx code</div>-->
                    <div class="checkbox checkbox--off">Wind</div>
                    <div class="checkbox checkbox--off">Gust</div>
                </div>
            </div>
        </div>
        <Footer />
        <!--
        <br /><br />
        <div>
            <div
                class="toggle-section checkbox header off"
                onclick="this.classList.toggle('off');"
                class:off={false}
            >
                Weather codes (not comprehensive):
            </div>
            <div>
                <div>
                    <b>Sky conditions:</b> SKC:&nbsp0/8, FEW:&nbsp1-2/8, SCT:&nbsp3-4/8, BKN:&nbsp5-7/8,
                    OVC:&nbsp8/8.
                </div>
                <div>
                    <b>Clouds:</b> CU:&nbspCumulus, CB:&nbspCumulonimbus, ST:&nbspStratus, SC:&nbspStratocumulus,
                    AC:&nbspAltocumulus, AS:&nbspAltostratus, NS:&nbspNimbostratus, CI:&nbspCirrus, CC:&nbspCirrocumulus,
                    CS:&nbspCirrostratus
                </div>
                <div>
                    <b>Obscuration:</b> BR:&nbspMist&nbsp(viz&#62;5/8sm), FG:&nbspFog&nbsp(viz&#60;5/8sm)
                </div>
                <div>
                    <b>Precip quantifier:</b> <b>-</b>&nbsp:&nbspLight, <b>+</b>&nbsp:&nbspHeavy
                </div>
                <div>
                    <b>Precipitation:</b> RA:&nbspRain, DZ:&nbspDrizzle, SN:&nbspSnow, FZ:&nbspFreezing,
                    SH:&nbspShowers, TS:&nbspThundershowers
                </div>
            </div>
        </div>
    -->
    </div>
</div>

<script lang="ts">
    // @ts-nocheck

    import { onDestroy, onMount } from 'svelte';
    import plugins from '@windy/plugins';
    import { map } from '@windy/map';

    import { init, closeCompletely } from './da_main.js';
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

    const thisPlugin = plugins[name];
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
        init(thisPlugin);
        node = thisPlugin.window.node;

        const wrapDiv = getWrapDiv();
        wrapDiv.appendChild(mainDiv);

        makeBottomRightHandle(cornerHandle, mainDiv);
        makeTopLeftHandle(cornerHandleTop, mainDiv);
        embedForTablet(thisPlugin);

        //// this should not be needed later
        node.querySelector(':scope > .closing-x').addEventListener(
            'click',
            () => (closeButtonClicked = true),
        );
        //

        focus();
        thisPlugin.focus = focus;
        thisPlugin.defocus = defocus;
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
</script>

<style lang="less">
    @import 'da.less?1757837195756';
</style>
