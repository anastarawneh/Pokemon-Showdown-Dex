var PokedexEncountersPanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		this.shortTitle = id;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/encounters/" data-target="push" class="subtle">Encounter List</a></h1>';

		buf += '<div><p>';
		buf += '<textarea class="import-team-text"></textarea>';
		buf += '<br><button id="import-btn">Import</button> <button id="reset-btn">Reset</button> <button id="help-btn">Help?</button> <button id="lua-btn">Lua Script</button>';
		buf += '</p></div>';

		buf += '<ul class="utilichart resultchart nokbd"></ul>';

		buf += '</div>';

		this.html(buf);

		var panel = this;
		this.$('#import-btn').click(function() {
			raw_sets = $('.import-team-text')[0].value;
			$('.import-team-text')[0].value = '';
			var rows = raw_sets.split("\n");
			var rawPokemon = [];
			var currentPokemon = [];
			for (var i = 0; i < rows.length; i++) {
				if (rows[i]) currentPokemon.push(rows[i]);
				else if (currentPokemon.length) {
					rawPokemon.push(currentPokemon);
					currentPokemon = [];
				}
			}
			
			var addedpokes = 0;
			var sets = {};
			for (var i = 0; i < rawPokemon.length; i++) {
				var pokemon = rawPokemon[i];
				var species = pokemon[0].includes('(') ? pokemon[0].split('(')[1].split(')')[0].trim() : pokemon[0].split('@')[0].trim();
				var location = '';
				for (var j = 0; j < pokemon.length; j++) {
					var row = pokemon[j];
					if (row.includes('Location: ')) location = row.split('Location: ')[1].split(" (")[0];
				}
				var speciesid = toID(species);
				var locationid = toID(location);
				if (!Object.keys(BattleLocationDex).includes(locationid) || !Object.keys(BattlePokedex).includes(speciesid)) {
					continue;
				}
				BattleLocationDex[locationid].taken = BattlePokedex[speciesid] ? BattlePokedex[speciesid].name : "Missed";
					if (BattleLocationDex[locationid].sublocations) {
						var sublocations = BattleLocationDex[locationid].sublocations;
						for (var k in BattleLocationDex[locationid].sublocations)
							BattleLocationDex[sublocations[k]].taken = BattlePokedex[speciesid] ? BattlePokedex[speciesid].name : "Missed";
					}
				sets[locationid] = speciesid;
				addedpokes++;
			}
			if (sets && addedpokes) {
				var encounters = JSON.parse(localStorage.encounters);
				jQuery.extend(encounters, sets);
				localStorage.encounters = JSON.stringify(encounters);
				panel.renderLocationList();
			} else {
				alert("No sets imported, please check your syntax and try again");
			}
		});

		this.$('#reset-btn').click(function() {
			localStorage.encounters = '{}';
			$('.dropdown').val('none');
			$('.dropdown').change();
		});

		this.$('#help-btn').click(function() {
			alert("This page tracks your encounters and marks dupes across the dex. Pastes imported here are separate from ones imported into the calculator.\n\n" +
				  "You will need a modified Lua script to import the correct data, you can download it using the \"Lua Script\" button.");
		});

		this.$('#lua-btn').click(function() {
			window.open("https://gist.github.com/anastarawneh/aa5f406ba474325b7c49e869a891c5b4#file-ek-modified-lua");
		});

		setTimeout(this.renderLocationList.bind(this));
	},
	getLocationList: function() {
		var results = [];
		for (var locationid in BattleLocationDex) {
			var location = BattleLocationDex[locationid];
			if (location.mainlocation) continue;
			results.push(locationid);
		}
		return this.results = results;
	},
	renderLocationList: function() {
		var results = this.getLocationList();
		this.$chart = this.$('.utilichart');
		
		var buf = '';
		for (var i=0, len=results.length; i<len; i++) {
			buf += '<li class="result">'+this.renderRow(i)+'</li>';
		}
		this.$chart.html(buf);
		
		$('.dropdown').select2();

		$('.select2-selection').click(function() {
			return false;
		});

		$(".dropdown").change(function() {
			var pokemonid = $(this).val();
			var locationid = $(this).attr("data-locationid");
			var encounters = JSON.parse(localStorage.encounters);
			if (pokemonid == 'none') {
				delete BattleLocationDex[locationid].taken;
				delete encounters[locationid];
				$(this).parent().siblings(".iconcol").remove();
			} else {
				BattleLocationDex[locationid].taken = toID(pokemonid);
				encounters[locationid] = BattlePokedex[pokemonid] ? pokemonid : "Missed";
				$(this).parent().siblings(".iconcol").remove();
				var buf = '<span class="col iconcol">';
				buf += '<span style="' + Dex.getPokemonIcon(pokemonid) + '"></span>';
				buf += '</span>';
				$(this).parent().after(buf);
			}
			localStorage.encounters = JSON.stringify(encounters);
		});
	},
	renderRow: function(i, offscreen) {
		var results = this.results;
		var locationid = results[i];
		var location = BattleLocationDex[locationid];
		if (offscreen) {
			return '' + location.name;
		} else {
			var buf = `<a href="/locations/${locationid}" data-target="push">`;
			buf += `<span class="col locationnamecol">${location.name}</span>`;
			buf += '<span class="col dropdowncol">';
			buf += '<select class="dropdown" data-locationid="' + locationid + '" style="width: 100%; font-size: 9pt;">';
			buf += '<option value="none">(None)</option>';
			buf += `<option value="missed"${location.taken && location.taken == 'Missed' ? ' selected="selected"' : ''}>(Missed)</option>`;
			var encounters = [];
			if (location.encounters) {
				buf += '<optgroup label="Route encounters">';
				for (var i in location.encounters) {
					var pokemonid = location.encounters[i].substr(10);
					if (encounters.includes(pokemonid)) continue;
					var pokemon = Dex.mod('gen3emeraldkaizo').species.get(pokemonid);
					buf += `<option value="${pokemonid}"${location.taken && toID(location.taken) == pokemonid ? ' selected="selected"' : ''}>${pokemon.name}</option>`;
					encounters.push(pokemonid);
				}
				buf += '</optgroup>';
				buf += '<optgroup label="Other">';
			}
			for (var pokemonid in BattlePokedex) {
				if (encounters.includes(pokemonid)) continue;
				var pokemon = Dex.mod('gen3emeraldkaizo').species.get(pokemonid);
				if (!pokemon.baseSpecies || pokemon.baseSpecies == pokemon.name) buf += `<option value="${pokemonid}"${location.taken && toID(location.taken) == pokemonid ? ' selected="selected"' : ''}>${pokemon.name}</option>`;
			}
			buf += '</optgroup></select></span>';
			if (location.taken) {
				buf += '<span class="col iconcol">';
				buf += '<span style="' + Dex.getPokemonIcon(location.taken) + '"></span>';
				buf += '</span> ';
			}
			buf += '</a>';
			return buf;
		}
	}
});