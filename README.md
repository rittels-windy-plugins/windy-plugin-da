# Density Altitude Plugin

Shows the density altitude in the custom picker.

The temperature, pressure (QNH) and dew point are loaded for the picker position.

The pressure altitude (PA), density altitude (DA) and DA corrected for dew point(DA_dp) are then calculated

Elevation is obtained from the Windy server,  and bathymetry (1km resolution) from: [https://topex.ucsd.edu/WWW_html/srtm30_plus.html](https://topex.ucsd.edu/WWW_html/srtm30_plus.html)

### Calculations:
    PA = elev + 27 x (1013-QNH)
    DA = PA + 118.8 x (temp-ISA)
    where ISA = 15 - 1.98 x PA/1000
    DA_dp = DA + 20 x Dew Point

https://en.wikipedia.org/wiki/Density_altitude

You can also choose a few other weather parameters to show on the left side of the picker.
