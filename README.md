# Multipicker

This plugin was originally made to show the density altitude for your location, thus `windy-plugin-da`.

It has since developed into a multipicker.  (A Swiss army knife picker.)  

## Features

Shows the **density altitude** in the custom picker.

The temperature, pressure (QNH), and dew point are loaded for the picker position.

The pressure altitude (PA), density altitude (DA) and DA corrected for dew point(DA_dp), are then calculated

Elevation is obtained from the Windy server,  and bathymetry (1 km resolution) from: [https://topex.ucsd.edu/WWW\_html/srtm30\_plus.html](https://topex.ucsd.edu/WWW_html/srtm30_plus.html)

Calculations

    PA = elev + 27 x (1013-QNH)
    DA = PA + 118.8 x (temp-ISA)
    where ISA = 15 - 1.98 x PA/1000
    DA_dp = DA + 20 x Dew Point

[https://en.wikipedia.org/wiki/Density_altitude](https://en.wikipedia.org/wiki/Density_altitude)

You can also select a few **other weather parameters** and display the coordinates of the picker position in different formats.  

You can set the following **Windy Picker settings** from this plugin:  Elevation in the picker and Coordinates below the picker.  This is useful in mobile, since the plugin use the original style desktop picker.   

The plugin also contains a **coordinate converter** between:  DDD°MM'SS.S",  DDD°MM.MMM' and DDD.DDDDD°.

- You can enter coordinates.
- Or paste coordinates,  they should be parsed and appear in the table.
- You can place the picker at those coordinates.
- The picker position can be reflected in the table.     

### Path to this plugin:

Once the plugin has been installed,  open it with the following URL:

[windy.com/plugin/multipicker/lat/lon](https://www.windy.com/plugin/multipicker/0/0)
