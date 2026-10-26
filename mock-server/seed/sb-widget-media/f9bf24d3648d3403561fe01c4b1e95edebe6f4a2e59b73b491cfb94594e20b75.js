/* Copyright (C) 2011 HeartRails Inc. All Rights Reserved. */

var geoapi_url = "https://geoapi.heartrails.com/api/json?jsonp=?";
var geoapi_area_selected;
var geoapi_prefecture_selected;
var geoapi_city_selected;
var geoapi_town_selected;
var geoapi_towns = null;

$("body").ready(geoApiInitialize);

function geoApiInitialize() {
    if ($("#geoapi-areas").length > 0) {
        geoApiInitializeAreas();
    }
    if ($("#geoapi-prefectures").length > 0) {
        geoApiInitializePrefectures();
    }
    geoApiInitializeCities();
    geoApiInitializeTowns();
    $("#geoapi-address").attr("disabled", true);
    $("#geoapi-areas").change(geoApiChangeArea);
    $("#geoapi-prefectures").change(geoApiChangePrefecture);
    $("#geoapi-cities").change(geoApiChangeCity);
    $("#geoapi-towns").change(geoApiChangeTown);
    $("#geoapi-postal-4").keyup(geoApiSearchByPostal);
}

function geoApiSetAreas (json) {
    var areas = json.response.area;
    for (var index = 0; index < areas.length; index++) {
        var option = $(document.createElement('option'));
        option.text(areas[index]);
        option.val(areas[index]);
        $('#geoapi-areas').append(option);
    }
}

function geoApiChangeArea () {
    geoapi_area_selected = $("#geoapi-areas option:selected");
    geoApiInitializeCities();
    geoApiInitializeTowns();
    if (geoapi_area_selected.val() == 'エリアを選択してください') {
      return;
    }
    $.getJSON(geoapi_url, { "method": "getCities", "area": geoapi_area_selected.text() }, setCities);
}

function geoApiSetPrefectures (json) {
    var prefectures = json.response.prefecture;
    for (var index = 0; index < prefectures.length; index++) {
        var option = $(document.createElement('option'));
        option.text(prefectures[index]);
        option.val(prefectures[index]);
        $('#geoapi-prefectures').append(option);
    }
}

function geoApiChangePrefecture () {
    geoapi_prefecture_selected = $("#geoapi-prefectures option:selected");
    geoApiInitializeCities();
    geoApiInitializeTowns();
    if (geoapi_prefecture_selected.val() == '都道府県を選択してください') {
      return;
    }
    $.getJSON(geoapi_url, { "method": "getCities", "prefecture": geoapi_prefecture_selected.text() }, setCities);
}

function setCities (json) {
    var cities = json.response['location'];
    for (var index = 0; index < cities.length; index++) {
        var option = $(document.createElement('option'));
        option.text(cities[index].city);
        option.val(cities[index].city);
        $('#geoapi-cities').append(option);
    }
}

function geoApiChangeCity () {
    geoapi_city_selected = $("#geoapi-cities option:selected");
    geoApiInitializeTowns();
    if (geoapi_city_selected.val() == '市区町村を選択してください') {
      return;
    }
    $.getJSON(geoapi_url, { "method": "getTowns", "city": geoapi_city_selected.text() }, geoApiSetTowns);
}

function geoApiSetTowns (json) {
    geoapi_towns = json.response['location'];
    var cities = json.response['location'];
    for (var index = 0; index < cities.length; index++) {
        var option = $(document.createElement('option'));
        option.text(cities[index].town);
        option.val(cities[index].town);
        $('#geoapi-towns').append(option);
    }
}

function geoApiChangeTown () {
    geoapi_town_selected = $("#geoapi-towns option:selected");
    if (geoapi_town_selected.val() == '町域を選択してください') {
      return;
    }
    var town = geoApiGetTownObject(geoapi_town_selected.text());
}

function geoApiGetTownObject (name) {
    var town = null;
    for (var index = 0; index < geoapi_towns.length; index++) {
        if (name == geoapi_towns[index].town) {
            town = geoapi_towns[index];
            break;
        }
    }
    return town;
}

function geiApiGetAddress (addresses) {
    var town = addresses[0].town.replace(/��.+|.?荳∫岼.*$/,"");
    $("#geoapi-address").val(addresses[0].prefecture + addresses[0].city + town);
}

function geoApiSearchByPostal (e) {
    var key_code = e.keyCode || event.keyCode;
    if (key_code != 9 && key_code != 37 && key_code != 38 && key_code != 39 && key_code != 40 && $("#geoapi-postal-4").val().length == 4) {
        var geoapi_postal_3 = $("input#geoapi-postal-3");
        var geoapi_postal_4 = $("input#geoapi-postal-4");
        if (!geoapi_postal_3.val() || !geoapi_postal_4.val()) {
            return false;
        }
        $.getJSON(geoapi_url, { "method": "searchByPostal", "postal": geoapi_postal_3.val() + geoapi_postal_4.val() }, geoapiSearchByPostalAfter);
    }
}

function geoapiSearchByPostalAfter (json) {
    if (json.response.error) {
        alert(json.response.error);
        return false;
    }
    var addresses = json.response['location'];
    geiApiGetAddress(addresses);
}

function geoApiInitializeAreas() {
    $("#geoapi-areas").html('<option value="エリアを選択してください">エリアを選択してください</option>');
    $.getJSON(geoapi_url, { "method": "getAreas" }, geoApiSetAreas);
}

function geoApiInitializePrefectures() {
    $("#geoapi-prefectures").html('<option value="都道府県を選択してください">都道府県を選択してください</option>');
    $.getJSON(geoapi_url, { "method": "getPrefectures" }, geoApiSetPrefectures);
}

function geoApiInitializeCities() {
    $("#geoapi-cities").html('<option value="市区町村を選択してください">市区町村を選択してください</option>');
}

function geoApiInitializeTowns() {
    $("#geoapi-towns").html('<option value="町域を選択してください">町域を選択してください</option>');
}