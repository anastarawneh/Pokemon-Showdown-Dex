var PokedexLocationPanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		var location = BattleLocationDex[id];
		this.id = id;
		this.name = location.name;

		var buf = '<div class="pfx-body dexentry">';

		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/locations/'+id+'" data-target="push" class="subtle">'+location.name+'</a></h1>';

		// getting it
		// warning: excessive trickiness
		var leftPanel = this.app.panels[this.app.panels.length - 2];
		if (leftPanel && leftPanel.fragment.slice(0, 8) === 'pokemon/') {
			var pokemon = Dex.species.get(leftPanel.id);
			var learnset = BattleLearnsets[pokemon.id] && BattleLearnsets[pokemon.id].learnset;
			if (!learnset) learnset = BattleLearnsets[toID(pokemon.baseSpecies)].learnset;
			var eg1 = pokemon.eggGroups[0];
			var eg2 = pokemon.eggGroups[2];
			var sources = learnset[id];
			var template = null;
			var atLeastOne = false;
			while (true) {
				if (!template) {
					template = pokemon;
				} else {
					if (!template.prevo) break;
					template = Dex.species.get(template.prevo);
					sources = BattleLearnsets[template.id].learnset[id];
				}

				if (!sources) continue;

				if (!atLeastOne) {
					buf += '<h3>Getting it on ' + pokemon.name + '</h3><ul>';
					atLeastOne = true;
				}

				if (template.id !== pokemon.id) {
					buf += '</ul><p>From ' + template.name + ':</p><ul>';
				}

				if (!sources.length) buf += '<li>(Past gen only)</li>';

				if (typeof sources === 'string') sources = [sources];
				for (var i=0, len=sources.length, gen=''+Dex.gen; i<len; i++) {
					var source = sources[i];
					var sourceType = source.charAt(1);
					if (source.charAt(0) === gen) {
						switch (sourceType) {
						case 'L':
							buf += '<li>Level ' + parseInt(source.slice(2, 5), 10) + '</li>';
							break;
						case 'M':
							buf += '<li>TM/HM</li>';
							break;
						case 'T':
							buf += '<li>Tutor</li>';
							break;
						case 'E':
							buf += '<li>Egg move: breed with ';
							var hasBreeders = false;
							for (var breederid in BattleLearnsets) {
								if (!BattleLearnsets[breederid].learnset || !BattleLearnsets[breederid].learnset[id]) continue;
								var breeder = BattlePokedex[breederid];
								if (breeder.isNonstandard) continue;
								if (breeder.gender && breeder.gender !== 'M') continue;
								if (breederid === pokemon.id || breederid === template.id || breederid === pokemon.prevo) continue;
								if (eg1 === breeder.eggGroups[0] || eg1 === breeder.eggGroups[1] ||
									(eg2 && (eg2 === breeder.eggGroups[0] || eg2 === breeder.eggGroups[1]))) {
									if (hasBreeders) buf += ', ';
									buf += '<a href="/pokemon/' + breederid + '" data-target="push">' + breeder.name + '</a>';
									hasBreeders = true;
								}
							}
							if (!hasBreeders) buf += 'itself';
							buf += '</li>';
							break;
						}
					} else if (source === '7V') {
						buf += '<li>Virtual Console transfer from Gen 1</li>';
					} else if (source === '8V') {
						buf += '<li>Pok&eacute;mon HOME transfer from Let\'s Go! Pikachu and Eevee</li>';
					}
					if (sourceType === 'S') {
						buf += '<li>Event move</li>';
					}
				}
			}
			if (atLeastOne) buf += '</ul>';
		}

		// distribution
		buf += '<ul class="utilichart metricchart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderDistribution.bind(this));
	},
	getDistribution: function() {
		var locationid = this.id;
		if (this.results) return this.results;
		var results = [];
        if (typeof BattleLocationDex[locationid].encounters !== 'undefined')
            for (var pokemon in BattleLocationDex[locationid].encounters)
                results.push(BattleLocationDex[locationid].encounters[pokemon]);
		if (typeof BattleLocationDex[locationid].sublocations !== 'undefined')
			for (var sublocation in BattleLocationDex[locationid].sublocations)
				results.push(BattleLocationDex[locationid].sublocations[sublocation])
		var last = '';
		for (var i=0; i<results.length; i++) {
			if (results[i].charAt(0) !== last) {
				results.splice(i, 0, results[i].charAt(0).toUpperCase());
				i++;
			}
			last = results[i].charAt(0);
		}
		return this.results = results;
	},
	renderDistribution: function() {
		var results = this.getDistribution();
		this.$chart = this.$('.utilichart');

		if (results.length > 1600/33) {
			this.streamLoading = true;
			this.$el.on('scroll', this.handleScroll.bind(this));

			var panelTop = this.$el.children().offset().top;
			var panelHeight = this.$el.outerHeight();
			var chartTop = this.$chart.offset().top;
			var scrollLoc = this.scrollLoc = this.$el.scrollTop();

			var start = Math.floor((scrollLoc - (chartTop-panelTop)) / 33 - 35);
			var end = Math.floor(start + 35 + panelHeight / 33 + 35);
			if (start < 0) start = 0;
			if (end > results.length-1) end = results.length-1;
			this.start = start, this.end = end;

			// distribution
			var buf = '';
			for (var i=0, len=results.length; i<len; i++) {
				buf += '<li class="result">'+this.renderRow(i, i < start || i > end)+'</li>';
			}
			this.$chart.html(buf);
		} else {
			var buf = '';
			for (var i=0, len=results.length; i<len; i++) {
				buf += '<li class="result">'+this.renderRow(i)+'</li>';
			}
			this.$chart.html(buf);
		}
	},
	renderRow: function(i, offscreen) {
		var results = this.results;
		if (BattleLocationDex[this.id].sublocations) {
			var id = results[i];
			var template = id ? BattleLocationDex[id] : undefined;
			if (!template) {
				return '<h3>Sublocations</h3>'
			} else {
				return BattleSearch.renderLocationRowInner(template);
			}
		}
		var id = results[i].substr(10);
		var template = id ? Dex.mod('gen3emeraldkaizo').species.get(id) : undefined;
		if (!template) {
			switch (results[i].charAt(0)) {
			case 'A':
				return '<h3>Grass</h3>';
			case 'B':
				return '<h3>Cave</h3>';
			case 'C':
				return '<h3>Old Rod</h3>';
			case 'D':
				return '<h3>Good Rod</h3>';
			case 'E':
				return '<h3>Super Rod</h3>';
			case 'F':
				return '<h3>Surfing</h3>';
            case 'G':
				return '<h3>Diving</h3>';
            case 'H':
                return '<h3>Rock Smash</h3>';
            case 'I':
                return '<h3>Gift</h3>'
            case 'J':
                return '<h3>Egg</h3>'
            case 'K':
				return '<h3>Fossil</h3>';
            case 'L':
                return '<h3>Special</h3>'
			}
			return '<pre>error: "'+results[i]+'"</pre>';
		} else if (offscreen) {
			return ''+template.name+' '+template.abilities['0']+' '+(template.abilities['1']||'')+' '+(template.abilities['H']||'')+'';
		} else {
			var chance = parseInt(results[i].substr(1, 3));
            var minLevel = parseInt(results[i].substr(4, 3));
            var maxLevel = parseInt(results[i].substr(7, 3));
            var desc = "";
            switch (results[i].charAt(0)) {
                case 'A':
                case 'B':
                case 'C':
                case 'D':
                case 'E':
                case 'F':
                case 'G':
                case 'H':
                    desc = chance + "%";
                    break;
                case 'I':
                case 'J':
                case 'K':
                case 'L':
                    desc = "-"
                    break;
            }
			var encounters = JSON.parse(localStorage.encounters);
			var evo1 = template;
			while (evo1.prevo) evo1 = Dex.mod('gen3emeraldkaizo').species.get(evo1.prevo);
			var family = [evo1.id];
			if (evo1.evos) {
				for (var i in evo1.evos) {
					var evo2 = Dex.mod('gen3emeraldkaizo').species.get(toID(evo1.evos[i]));
					family.push(evo2.id);
					if (evo2.evos) {
						for (var j in evo2.evos) {
							var evo3 = Dex.mod('gen3emeraldkaizo').species.get(toID(evo2.evos[j]));
							family.push(evo3.id);
						}
					}
				}
			}
			var marked = false;
			for (var locationid in encounters) {
				for (var i in family) {
					if (encounters[locationid] == family[i]) {
						desc += 'D';
						marked = true;
						break;
					}
				}
				if (marked) break;
			}
			return BattleSearch.renderTaggedLocationPokemonRowInner(template, desc, minLevel, maxLevel);
		}
	},
	handleScroll: function() {
		var scrollLoc = this.$el.scrollTop();
		if (Math.abs(scrollLoc - this.scrollLoc) > 20*33) {
			this.renderUpdateDistribution();
		}
	},
	debouncedPurgeTimer: null,
	renderUpdateDistribution: function(fullUpdate) {
		if (this.debouncedPurgeTimer) {
			clearTimeout(this.debouncedPurgeTimer);
			this.debouncedPurgeTimer = null;
		}

		var panelTop = this.$el.children().offset().top;
		var panelHeight = this.$el.outerHeight();
		var chartTop = this.$chart.offset().top;
		var scrollLoc = this.scrollLoc = this.$el.scrollTop();

		var results = this.results;

		var rowFit = Math.floor(panelHeight / 33);

		var start = Math.floor((scrollLoc - (chartTop-panelTop)) / 33 - 35);
		var end = start + 35 + rowFit + 35;
		if (start < 0) start = 0;
		if (end > results.length-1) end = results.length-1;

		var $rows = this.$chart.children();

		if (fullUpdate || start < this.start - rowFit - 30 || end > this.end + rowFit + 30) {
			var buf = '';
			for (var i=0, len=results.length; i<len; i++) {
				buf += '<li class="result">'+this.renderRow(i, (i < start || i > end))+'</li>';
			}
			this.$chart.html(buf);
			this.start = start, this.end = end;
			return;
		}

		if (start < this.start) {
			for (var i = start; i<this.start; i++) {
				$rows[i].innerHTML = this.renderRow(i);
			}
			this.start = start;
		}

		if (end > this.end) {
			for (var i = this.end+1; i<=end; i++) {
				$rows[i].innerHTML = this.renderRow(i);
			}
			this.end = end;
		}

		if (this.end - this.start > rowFit+90) {
			var self = this;
			this.debouncedPurgeTimer = setTimeout(function() {
				self.renderUpdateDistribution(true);
			}, 1000);
		}
	}
});
