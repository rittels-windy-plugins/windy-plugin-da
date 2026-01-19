import store from '@windy/store';
import geoloc from '@windy/geolocation';
import { map } from '@windy/map';

const { abs, trunc, round } = Math;

let coords = {
    dms: {},
    dm: {},
    d: {},
};

let myloc = geoloc.getMyLatestPos() || { lat: 0, lon: 0 };

let coordSign = {
    N: { val: 1, el: null, selected: myloc.lat >= 0 },
    S: { val: -1, el: null, selected: myloc.lat < 0 },
    E: { val: 1, el: null, selected: myloc.lon >= 0 },
    W: { val: -1, el: null, selected: myloc.lon < 0 },
};

/** returns array of [d,m,s] */
function convertCoords(v, type) {
    if (type == 'd') return [round(v * 1e7) / 1e7];
    let d = trunc(v);
    let m = Math.round(1e8 * (v % 1) * 60) / 1e8;
    if (type == 'dm') {
        return [d, round(m * 1000) / 1000];
    }
    let mi = trunc(m);
    let s = Math.round(1e8 * (m % 1) * 60) / 1e8;
    return [d, mi, round(s * 10) / 10];
}

/** accepts array of [dms] */
function convertCoords2Dec([d, m, s], type) {
    return type == 'd' ? d : type == 'dm' ? d + m / 60 : d + m / 60 + s / 3600;
}

for (let p in coords) {
    coords[p] = { lt: [], ln: [] };
    for (let c of p) {
        coords[p].lt.push({ val: 0, el: null });
        coords[p].ln.push({ val: 0, el: null });
    }
    coords[p].f = ar => convertCoords2Dec(ar, p);
    coords[p].f2 = v => convertCoords(v, p);
}

function changeSign(e) {
    let v = e.target ? e.target.innerHTML.trim() : e;
    let desel = v == 'N' ? 'S' : v == 'S' ? 'N' : v == 'E' ? 'W' : 'E';
    coordSign[v].el.classList.add('selected');
    coordSign[v].selected = true;
    coordSign[desel].el.classList.remove('selected');
    coordSign[desel].selected = false;
}

function fillFields(ltln, decVal) {
    for (let p in coords) {
        let ar = coords[p].f2(decVal);
        ar.forEach((e, i) => {
            let c = coords[p][ltln][i];
            c.val = e;
            c.el.value = e;
        });
    }
}

// also validate
function handleCoordsInput(e) {
    let el = e.target;
    let type = el.dataset.ref.slice(2, -1);
    let ltln = el.dataset.ref.slice(0, 2);
    let n = +el.dataset.ref.slice(-1);

    let { value } = el;

    // validate
    if (e.data == '.') {
        if (n < type.length - 1) {
            //only allow dec for last field
            el.value = value.slice(0, -1);
            return;
        }
        if (value.slice(-2) == '..') el.value = value.slice(0, -1); // ignore ..
        return;
    }
    if (isNaN(value)) {
        value = value.slice(0, -1);
        if (isNaN(value)) {
            el.value = '';
            return;
        }
    }
    if (type == 'dms' && n == 2 && value.length > 4) {
        el.value = value = value.slice(0, 4);
    } else if (type == 'dm' && n == 1 && value.length > 6) {
        el.value = value = value.slice(0, 6);
    } else if (type == 'd' && ('' + value).length > 10) {
        el.value = value = value.slice(0, 10);
    }

    value = +value;
    if (n > 0 && value >= 60) {
        el.value = el.value.slice(0, -1);
        return;
    }
    if (n > 0 && value < 0) {
        el.value = '';
        return;
    }

    coords[type][ltln][n].val = value;
    let ar = coords[type][ltln].map(e => e.val || 0);
    let decVal = coords[type].f(ar);
    if ((decVal > 180 && ltln == 'ln') || (decVal > 90 && ltln == 'lt')) {
        el.value = el.value.slice(0, -1);
        coords[type][ltln][n].val = +el.value;
        return;
    }

    fillFields(ltln, decVal);
}

function placePicker(pickerT) {
    let lat = coords.d.lt[0].val;
    let lon = coords.d.ln[0].val;
    if (coordSign.S.selected) lat *= -1;
    if (coordSign.W.selected) lon *= -1;

    map.panTo({ lat, lng: lon });

    pickerT.openMarker({ lat, lon });
}

function coordsToFields(latlon) {
    let lat, lon;
    if (Array.isArray(latlon)) [lat, lon] = latlon;
    else ({ lat, lon } = latlon);
    fillFields('lt', abs(lat));
    fillFields('ln', abs(lon));
    changeSign(lat > 0 ? 'N' : 'S');
    changeSign(lon > 0 ? 'E' : 'W');
}

function parse(s) {
    s = s.trim().toUpperCase();
    let lat, lng;
    let lata, lnga;
    let mns = s.match(/[N|S]/);
    let mew = s.match(/[E|W]/);
    let NS, EW;
    if (mns && mew) {
        //   N12 12 44 E22 33 44   or   W34 34 34 S34 34 34
        let NSi, EWi;
        NS = mns[0] == 'N' ? 'N' : 'S';
        NSi = mns.index;
        EW = mew[0] == 'E' ? 'E' : 'W';
        EWi = mew.index;

        let middle, end, lat, lng;
        if (NSi < 1 || NS > s.length - 2) {
            middle = EWi;
            end = NSi;
        } else {
            middle = NSi;
            end = EWi;
        }
        let s1 = s.slice(0, middle).replace(end, '');
        let s2 = s.slice(middle).replace(end, '');
        if (NSi < EWi) {
            (lat = s1), (lng = s2);
        } else {
            (lat = s2), (lng = s1);
        }
        lata = lat.match(/[\d|\.]+/g);
        lnga = lng.match(/[\d|\.]+/g);
        return [lata, NS, lnga, EW];
    } else {
        //look for comma
        let a = s.split(',');
        if (a.length == 2) {
            // 23 34 35, 34 34 34
            lat = a[0];
            lng = a[1];
        } else {
            let ixs = [...s]
                .map((ch, i) => (ch === '-' || ch === '+' ? { i, ch } : null))
                .filter(i => i);

            if (ixs.length > 1 || (ixs.length == 1 && ixs[0].i > 0)) {
                // +23 24 4 -22 34 34
                let middle = ixs.length == 1 ? ixs[0].i : ixs[1].i;
                if (middle) {
                    //  34 34 34 +/- 34 34 34
                    lat = s.slice(0, middle);
                    lng = s.slice(middle);
                }
            } else {
                // 34 35 35 35 35 23 (fails if not even number of groups.)
                let arrAll = s.match(/[\d|\.]+/g);
                if (arrAll == null) return;
                if (arrAll.length % 2 == 0) {
                    lata = arrAll.slice(0, arrAll.length / 2);
                    lnga = arrAll.slice(arrAll.length / 2);
                    NS = s[0] == '-' ? 'S' : 'N'; // there may be a minus at the start.
                    EW = 'E';
                    return [lata, NS, lnga, EW];
                }
            }
        }
        if (lat && lng) {
            lata = lat.match(/[\d|\.]+/g);
            lnga = lng.match(/[\d|\.]+/g);
            NS = lat.includes('-') ? 'S' : 'N';
            EW = lng.includes('-') ? 'W' : 'E';
            return [lata, NS, lnga, EW];
        }
    }
}

function stringToLatLon(s) {
    let parsed = parse(s);
    console.log(parsed);
    if (!parsed || parsed.some(p => p == null)) return 'invalid';

    const ar2val = ar => {
        let v = +ar[0];
        if (ar[1] !== undefined) v += +ar[1] / 60;
        if (ar[2] !== undefined) v += +ar[2] / 3600;
        return v;
    };
    return [
        ar2val(parsed[0]) * (parsed[1] == 'N' ? 1 : -1),
        ar2val(parsed[2]) * (parsed[3] == 'E' ? 1 : -1),
    ];
}

export {
    coords,
    coordSign,
    changeSign,
    handleCoordsInput,
    placePicker,
    coordsToFields,
    stringToLatLon,
};
