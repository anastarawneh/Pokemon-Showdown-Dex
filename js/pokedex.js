BattleSearch.urlRoot = '/';

Dex.escapeHTML = function (str, jsEscapeToo) {
	str = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	if (jsEscapeToo) str = str.replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
	return str;
};

var Topbar = Panels.Topbar.extend({
	height: 51
});

var PokedexResultPanel = Panels.Panel.extend({
	minWidth: 639,
	maxWidth: 639,
	initialize: function() {
		this.html('not found: '+Array.prototype.join.call(arguments,' || '));
	}
});

var PokedexItemPanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		var item = Dex.items.get(id);
		this.id = id;
		this.shortTitle = item.name;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><span class="itemicon" style="'+Dex.getItemIcon(item)+'"></span> <a href="/items/'+id+'" data-target="push" class="subtle">'+item.name+'</a></h1>';
		buf += '<p>'+Dex.escapeHTML(item.desc||item.shortDesc)+'</p>';

		// past gens
		var pastGenChanges = false;
		for (var genNum = Dex.gen - 1; genNum >= item.gen; genNum--) {
			var nextGenItem = Dex.forGen(genNum + 1).items.get(id);
			var curGenItem = Dex.forGen(genNum).items.get(id);
			var changes = '';

			if (curGenItem.shortDesc !== nextGenItem.shortDesc) {
				changes += curGenItem.shortDesc + ' <i class="fa fa-long-arrow-right"></i> ' + nextGenItem.shortDesc + '<br />';
			}

			if (changes) {
				if (!pastGenChanges) buf += '<h3>Past gens</h3><dl>';
				buf += '<dt>Gen ' + genNum + ' <i class="fa fa-arrow-right"></i> ' + (genNum + 1) + ':</dt>';
				buf += '<dd>' + changes + '</dd>';
				pastGenChanges = true;
			}
		}
		if (pastGenChanges) buf += '</dl>';

		// distribution
		buf += '<ul class="utilichart metricchart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderDistribution.bind(this));
	},
	getDistribution: function() {
		var itemid = this.id;
		if (this.results) return this.results;
		var results = [];
		for (var pokemonid in BattlePokedex) {
			if (!BattlePokedex[pokemonid]) continue;
			var items = Dex.mod('gen3emeraldkaizo').species.get(pokemonid).heldItems;
			if (!items) continue;
			for (var i in items) {
				if (items[i].substr(3) == itemid) {
					var chance = items[i].substr(0, 3);
					results.push(chance+pokemonid);
					break;
				}
			}
		}
		results.sort(function (x, y) {
			var xp = x.substr(0, 3);
			var yp = y.substr(0, 3);
  			return xp == yp ? 0 : xp < yp ? -1 : 1;
		});
		if (results) {
			results.splice(0, 0, 'A')
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
		var pokemonid = results[i].substr(3);
		var chance = parseInt(results[i].substr(0, 3));

		var template = pokemonid ? Dex.mod('gen3emeraldkaizo').species.get(pokemonid) : undefined;
		if (!template) {
			return '<h3>Held by</h3>';
		} else if (offscreen) {
			return ''+template.name+' '+template.abilities['0']+' '+(template.abilities['1']||'')+' '+(template.abilities['H']||'')+'';
		} else {
			var desc = chance + '%';
		}
		return BattleSearch.renderTaggedPokemonRowInner(template, desc);
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
var PokedexAbilityPanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		var ability = Dex.abilities.get(id);
		this.id = id;
		this.shortTitle = ability.name;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/abilities/'+id+'" data-target="push" class="subtle">'+ability.name+'</a></h1>';

		if (ability.isNonstandard && ability.id !== 'noability') buf += '<div class="warning"><strong>Note:</strong> This is a made-up ability by <a href="http://www.smogon.com/cap/" target="_blank">Smogon CAP</a>.</div>';

		buf += '<p>'+Dex.escapeHTML(ability.desc)+'</p>';

		// past gens
		var pastGenChanges = false;
		for (var genNum = Dex.gen - 1; genNum >= ability.gen; genNum--) {
			var nextGenAbility = Dex.forGen(genNum + 1).abilities.get(id);
			var curGenAbility = Dex.forGen(genNum).abilities.get(id);
			var changes = '';

			if (curGenAbility.shortDesc !== nextGenAbility.shortDesc) {
				changes += curGenAbility.shortDesc + ' <i class="fa fa-long-arrow-right"></i> ' + nextGenAbility.shortDesc + '<br />';
			}

			if (changes) {
				if (!pastGenChanges) buf += '<h3>Past gens</h3><dl>';
				buf += '<dt>Gen ' + genNum + ' <i class="fa fa-arrow-right"></i> ' + (genNum + 1) + ':</dt>';
				buf += '<dd>' + changes + '</dd>';
				pastGenChanges = true;
			}
		}
		if (pastGenChanges) buf += '</dl>';

		// pokemon
		buf += '<h3>Pok&eacute;mon with this ability</h3>';
		buf += '<ul class="utilichart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderPokemonList.bind(this));
	},
	renderPokemonList: function(list) {
		var ability = Dex.abilities.get(this.id);
		var buf = '';
		for (var pokemonid in BattlePokedex) {
			var template = Dex.mod('gen3emeraldkaizo').species.get(pokemonid);
			if (template.isNonstandard && !ability.isNonstandard) continue;
			if (template.abilities['0'] === ability.name || template.abilities['1'] === ability.name || template.abilities['H'] === ability.name) {
				buf += BattleSearch.renderPokemonRow(template);
			}
		}
		this.$('.utilichart').html(buf);
	}
});
var PokedexTypePanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		this.type = id[0].toUpperCase()+id.substr(1);
		var type = Dex.types.get(this.type);
		this.shortTitle = this.type;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/types/'+id+'" data-target="push" class="subtle">'+this.type+'</a></h1>';
		buf += '<dl>';
		var atLeastOne = false;

		buf += '<dt>Weaknesses:</dt> <dd>';
		for (var attackType in type.damageTaken) {
			if (type.damageTaken[attackType] == 1) {
				buf += '<a href="/types/'+toID(attackType)+'" data-target="push">'+Dex.getTypeIcon(attackType)+'</a> ';
				atLeastOne = true;
			}
		}
		if (!atLeastOne) {
			buf += '<em>No weaknesses</em>';
		}
		buf += '</dd>';

		buf += '<dt>Resistances:</dt> <dd>';
		atLeastOne = false;
		for (var attackType in type.damageTaken) {
			if (type.damageTaken[attackType] == 2) {
				buf += '<a href="/types/'+toID(attackType)+'" data-target="push">'+Dex.getTypeIcon(attackType)+'</a> ';
				atLeastOne = true;
			}
		}
		if (!atLeastOne) {
			buf += '<em>No resistances</em>';
		}
		buf += '</dd>';

		buf += '<dt>Immunities:</dt> <dd>';
		atLeastOne = false;
		for (var attackType in type.damageTaken) {
			if (type.damageTaken[attackType] == 3) {
				if (attackType === attackType.toLowerCase()) {
					switch (attackType) {
					case 'hail':
						buf += '<div><small><a href="/moves/hail" data-target="push">Hail</a> damage</small></div>';
						break;
					case 'sandstorm':
						buf += '<div><small><a href="/moves/sandstorm" data-target="push">Sandstorm</a> damage</small></div>';
						break;
					case 'powder':
						buf += '<div><small><a href="/tags/powder" data-target="push">Powder moves</a></small></div>';
						break;
					case 'frz':
						buf += '<div><small>FRZ status</small></div>';
						break;
					case 'brn':
						buf += '<div><small>BRN status</small></div>';
						break;
					case 'psn':
						buf += '<div><small>PSN status</small></div>';
						break;
					case 'par':
						buf += '<div><small>PAR status</small></div>';
						break;
					}
					if (!atLeastOne) atLeastOne = null;
					continue;
				}
				buf += '<a href="/types/'+toID(attackType)+'" data-target="push">'+Dex.getTypeIcon(attackType)+'</a> ';
				atLeastOne = true;
			}
		}
		if (!atLeastOne) {
			if (atLeastOne === null) {
				buf += '<div><em>No type immunities</em></div>';
			} else {
				buf += '<em>No immunities</em>';
			}
		}
		buf += '</dd>';

		buf += '</dl>';

		// move list
		buf += '<ul class="tabbar"><li><button class="button nav-first cur" value="move">Moves</button></li><li><button class="button nav-last" value="pokemon">Pokemon</button></li></ul>';
		buf += '<ul class="utilichart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderMoveList.bind(this));
	},
	events: {
		'click .tabbar button': 'selectTab'
	},
	selectTab: function(e) {
		this.$('.tabbar button').removeClass('cur');
		$(e.currentTarget).addClass('cur');
		switch (e.currentTarget.value) {
		case 'move':
			this.renderMoveList();
			break;
		case 'pokemon':
			this.renderPokemonList();
			break;
		}
	},
	renderMoveList: function() {
		var type = this.type;
		var buf = '<li class="resultheader"><h3>Physical '+type+' moves</h3></li>';
		for (var moveid in BattleMovedex) {
			var move = BattleMovedex[moveid];
			if (move.type === type && move.category === 'Physical') {
				buf += BattleSearch.renderMoveRow(move);
			}
		}
		this.$('.utilichart').html(buf)
			.css('min-height', 27*3 + 33*BattleSearchCountIndex[type+' move']);

		setTimeout(this.renderMoveList2.bind(this));
	},
	renderMoveList2: function() {
		var type = this.type;
		var bufs = ['<li class="resultheader"><h3>Physical '+type+' moves</h3></li>','<li class="resultheader"><h3>Special '+type+' moves</h3></li>','<li class="resultheader"><h3>Status '+type+' moves</h3></li>'];
		var bufChart = {Physical:0,Special:1,Status:2};
		for (var moveid in BattleMovedex) {
			var move = BattleMovedex[moveid];
			if (move.type === type) {
				bufs[bufChart[move.category]] += BattleSearch.renderMoveRow(move);
			}
		}
		this.$('.utilichart').html(bufs.join(''))
			.css('min-height', 27*3 + 33*BattleSearchCountIndex[type+' move']);
	},
	renderPokemonList: function() {
		var type = this.type;
		var pureBuf = '<li class="resultheader"><h3>Pure '+type+' Pok&eacute;mon</h3></li>';
		for (var templateid in BattlePokedex) {
			var template = BattlePokedex[templateid];
			if (template.types[0] === type && !template.types[1]) {
				pureBuf += BattleSearch.renderPokemonRow(template);
			}
		}
		this.$('.utilichart').html(pureBuf)
			.css('min-height', 27*3 + 33*BattleSearchCountIndex[type+' pokemon']);

		setTimeout(this.renderPokemonList2.bind(this));
	},
	renderPokemonList2: function() {
		var type = this.type;
		var primaryBuf = '<li class="resultheader"><h3>Primary '+type+' Pok&eacute;mon</h3></li>';
		var secondaryBuf = '<li class="resultheader"><h3>Secondary '+type+' Pok&eacute;mon</h3></li>';
		for (var templateid in BattlePokedex) {
			var template = BattlePokedex[templateid];
			if (template.types[0] === type) {
				if (template.types[1]) {
					primaryBuf += BattleSearch.renderPokemonRow(template);
				}
			} else if (template.types[1] === type) {
				secondaryBuf += BattleSearch.renderPokemonRow(template);
			}
		}
		this.$('.utilichart').append(primaryBuf + secondaryBuf);
	}
});
var PokedexTagPanel = PokedexResultPanel.extend({
	table: {
		contact: {
			name: 'Contact',
			tag: 'contact',
			desc: 'Affected by a variety of moves, abilities, and items.</p><p>Moves affected by contact moves include: Spiky Shield, King\'s Shield. Abilities affected by contact moves include: Iron Barbs, Rough Skin, Gooey, Flame Body, Static, Tough Claws. Items affected by contact moves include: Rocky Helmet, Sticky Barb.'
		},
		sound: {
			name: 'Sound',
			tag: 'sound',
			desc: 'Bypasses <a href="/moves/substitute" data-target="push">Substitute</a>. Doesn\'t affect <a href="/abilities/soundproof" data-target="push">Soundproof</a> Pok&eacute;mon.'
		},
		powder: {
			name: 'Powder',
			tag: 'powder',
			desc: 'Doesn\'t affect <a href="/types/grass" data-target="push">Grass-type</a> Pok&eacute;mon, <a href="/abilities/overcoat" data-target="push">Overcoat</a> Pok&eacute;mon, or <a href="/items/safetygoggles" data-target="push">Safety Goggles</a> holders.'
		},
		fist: {
			name: 'Fist',
			tag: 'punch',
			desc: 'Boosted 1.2x by <a href="/abilities/ironfist" data-target="push">Iron Fist</a>.'
		},
		pulse: {
			name: 'Pulse',
			tag: 'pulse',
			desc: 'Boosted 1.5x by <a href="/abilities/megalauncher" data-target="push">Mega Launcher</a>.'
		},
		bite: {
			name: 'Bite',
			tag: 'bite',
			desc: 'Boosted 1.5x by <a href="/abilities/strongjaw" data-target="push">Strong Jaw</a>.'
		},
		ballistic: {
			name: 'Ballistic',
			tag: 'bullet',
			desc: 'Doesn\'t affect <a href="/abilities/bulletproof" data-target="push">Bulletproof</a> Pok&eacute;mon.'
		},
		slicing: {
			name: 'Slicing',
			tag: 'slicing',
			desc: 'Boosted 1.5x by <a href="/abilities/sharpness" data-target="push">Sharpness</a>.'
		},
		wind: {
			name: 'Wind',
			tag: 'wind',
			desc: 'Pok&eacute;mon with <a href="/abilities/windpower" data-target="push">Wind Power</a> gain the charge effect after being hit. Pok&eacute;mon with <a href="/abilities/windrider" data-target="push">Wind Rider</a> have their Attack raised by 1 stage and are immune.'
		},
		bypassprotect: {
			name: 'Bypass Protect',
			tag: '',
			desc: 'Bypasses <a class="subtle" href="/moves/protect" data-target="push">Protect</a>, <a class="subtle" href="/moves/detect" data-target="push">Detect</a>, <a class="subtle" href="/moves/kingsshield" data-target="push">King\'s Shield</a>, and <a class="subtle" href="/moves/spikyshield" data-target="push">Spiky Shield</a>.'
		},
		nonreflectable: {
			name: 'Nonreflectable',
			tag: '',
			desc: 'Can\'t be bounced by <a class="subtle" href="/moves/magiccoat" data-target="push">Magic Coat</a> or <a class="subtle" href="/abilities/magicbounce" data-target="push">Magic Bounce</a>.'
		},
		nonmirror: {
			name: 'Nonmirror',
			tag: '',
			desc: 'Can\'t be copied by <a class="subtle" href="/moves/mirrormove" data-target="push">Mirror Move</a>.'
		},
		nonsnatchable: {
			name: 'Nonsnatchable',
			tag: '',
			desc: 'Can\'t be copied by <a class="subtle" href="/moves/snatch" data-target="push">Snatch</a>.'
		},
		bypasssub: {
			name: 'Bypass Substitute',
			tag: 'bypasssub',
			desc: 'Bypasses but does not break a <a class="subtle" href="/moves/substitute" data-target="push">Substitute</a>.'
		},
		zmove: {
			name: 'Z-Move',
			tag: '',
			desc: 'Is a <a class="subtle" href="/articles/zmoves" data-target="push">Z-Move</a>.'
		},
		maxmove: {
			name: 'Max Move',
			tag: '',
			desc: 'Is a <a class="subtle" href="/articles/maxmoves" data-target="push">Max Move</a>.'
		},
		gmaxmove: {
			name: 'G-Max Move',
			tag: '',
			desc: 'Is a <a class="subtle" href="/articles/gmaxmoves" data-target="push">G-Max Move</a>.'
		}
	},
	initialize: function(id) {
		var tag = this.table[id];
		var name = (tag ? tag.name : id);
		this.id = id;
		this.shortTitle = name;

		var buf = '<div class="pfx-body dexentry">';

		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/tags/'+id+'" data-target="push" class="subtle">'+name+'</a></h1>';

		if (tag) buf += '<p>'+tag.desc+'</p>';

		// distribution
		buf += '<h3>'+name+' moves</h3>';
		buf += '<ul class="utilichart metricchart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderDistribution.bind(this));
	},
	getDistribution: function() {
		if (this.results) return this.results;
		var tag = (this.id in this.table ? this.table[this.id].tag : this.id);
		var results = [];
		if (tag) {
			for (var moveid in BattleMovedex) {
				if (BattleMovedex[moveid].flags && tag in BattleMovedex[moveid].flags) results.push(moveid);
			}
		} else if (this.id === 'bypassprotect') {
			for (var moveid in BattleMovedex) {
				if (BattleMovedex[moveid].target !== 'self' && BattleMovedex[moveid].flags && !('protect' in BattleMovedex[moveid].flags)) {
					results.push(moveid);
				}
			}
		} else if (this.id === 'nonreflectable') {
			for (var moveid in BattleMovedex) {
				if (BattleMovedex[moveid].target !== 'self' && BattleMovedex[moveid].category === 'Status' && BattleMovedex[moveid].flags && !('reflectable' in BattleMovedex[moveid].flags)) {
					results.push(moveid);
				}
			}
		} else if (this.id === 'zmove') {
			for (var moveid in BattleMovedex) {
				if (BattleMovedex[moveid].isZ) {
					results.push(moveid);
				}
			}
		} else if (this.id === 'nonmirror') {
			for (var moveid in BattleMovedex) {
				if (BattleMovedex[moveid].target !== 'self' && BattleMovedex[moveid].flags && !('mirror' in BattleMovedex[moveid].flags)) {
					results.push(moveid);
				}
			}
		} else if (this.id === 'nonsnatchable') {
			for (var moveid in BattleMovedex) {
				if ((BattleMovedex[moveid].target === 'allyTeam' || BattleMovedex[moveid].target === 'self' || BattleMovedex[moveid].target === 'adjacentAllyOrSelf') && BattleMovedex[moveid].flags && !('snatch' in BattleMovedex[moveid].flags)) {
					results.push(moveid);
				}
			}
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
		var move = BattleMovedex[results[i]];
		if (offscreen) {
			return move.name;
		} else {
			return BattleSearch.renderMoveRowInner(move);
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
var PokedexEggGroupPanel = PokedexResultPanel.extend({
	table: {
		amorphous: {
			name: 'Amorphous',
			desc: ""
		},
		bug: {
			name: 'Bug',
			desc: ""
		},
		ditto: {
			name: 'Ditto',
			desc: "Can breed with anything."
		},
		dragon: {
			name: 'Dragon',
			desc: ""
		},
		fairy: {
			name: 'Fairy',
			desc: ""
		},
		field: {
			name: 'Field',
			desc: ""
		},
		flying: {
			name: 'Flying',
			desc: ""
		},
		grass: {
			name: 'Grass',
			desc: ""
		},
		humanlike: {
			name: 'Human-Like',
			desc: ""
		},
		mineral: {
			name: 'Mineral',
			desc: ""
		},
		monster: {
			name: 'Monster',
			desc: ""
		},
		plant: {
			name: 'Plant',
			desc: ""
		},
		undiscovered: {
			name: 'Undiscovered',
			desc: "Can't breed."
		},
		water1: {
			name: 'Water 1',
			desc: ""
		},
		water2: {
			name: 'Water 2',
			desc: ""
		},
		water3: {
			name: 'Water 3',
			desc: ""
		}
	},
	initialize: function(id) {
		var ids = id.split('+');
		for (var i = 0; i < ids.length; i++) ids[i] = toID(ids[i]);
		this.id = ids[0];
		var names = this.table[ids[0]].name;
		this.shortTitle = names;
		if (ids[1]) {
			this.id2 = ids[1];
			names += ' + '+this.table[ids[1]].name;
			this.shortTitle = "Egg groups";
		}

		var buf = '<div class="pfx-body dexentry">';

		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/egggroups/'+id+'" data-target="push" class="subtle">'+names+'</a></h1>';

		if (this.id2) {
			buf += '<p>All Pok&eacute;mon in either the <a href="/egggroups/'+this.id+'" data-target="push">'+this.table[ids[0]].name+'</a> or <a href="/egggroups/'+this.id2+'" data-target="push">'+this.table[ids[1]].name+'</a> egg group.</p>';
		} else {
			buf += '<p>'+this.table[ids[0]].desc+'</p>';
		}

		// distribution
		buf += '<h3>Basic '+names+' pokemon</h3>';
		buf += '<ul class="utilichart metricchart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderDistribution.bind(this));
	},
	getDistribution: function() {
		var name = this.table[this.id].name;
		var name2 = '!';
		if (this.id2) name2 = this.table[this.id2].name;
		if (this.results) return this.results;
		var results = [];
		for (var pokemonid in BattlePokedex) {
			var pokemon = BattlePokedex[pokemonid];
			var eggGroups = pokemon.eggGroups;
			// var prevo = toID(pokemon.prevo);
			if (!eggGroups || pokemon.forme) continue;
			// || (prevo && BattlePokedex[prevo].eggGroups[0] !== "Undiscovered") - irrelevant in gen 9
			if (pokemon && pokemon.isNonstandard) continue;
			if (eggGroups[0] === name || eggGroups[1] === name ||
				eggGroups[0] === name2 || eggGroups[1] === name2) {
				results.push(pokemonid);
			}
		}
		results.sort();
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
		var template = BattlePokedex[results[i]];
		if (offscreen) {
			return ''+template.species+' '+template.abilities['0']+' '+(template.abilities['1']||'')+' '+(template.abilities['H']||'')+'';
		} else {
			return BattleSearch.renderTaggedPokemonRowInner(template, '<span class="picon" style="margin-top:-12px;'+Dex.getPokemonIcon('egg')+'"></span>');
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
var PokedexCategoryPanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		var category = {
			id: id,
			name: id[0].toUpperCase()+id.substr(1)
		};
		this.shortTitle = category.name;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/categories/'+id+'" data-target="push" class="subtle">'+category.name+'</a></h1>';
		switch (id) {
		case 'physical':
			buf += '<p>Physical moves are damaging moves generally calculated with the user\'s Attack stat and the target\'s Defense stat.</p>';
			break;
		case 'special':
			buf += '<p>Special moves are damaging moves generally calculated with the user\'s Special Attack stat and the target\'s Special Defense stat.</p>';
			break;
		case 'status':
			buf += '<p>Status moves are moves that don\'t deal damage directly.</p>';
			break;
		}
		buf += '</div>';

		this.html(buf);
	}
});
var PokedexTierPanel = PokedexResultPanel.extend({
	initialize: function(id) {
		var tierTable = {
			/*ag: "AG",
			uber: "Uber",
			ou: "OU",
			uu: "UU",
			ru: "RU",
			nu: "NU",
			pu: "PU",
			nfe: "NFE",
			lcuber: "LC Uber",
			lc: "LC",
			cap: "CAP",
			capnfe: "CAP NFE",
			caplc: "CAP LC",
			uubl: "UUBL",
			rubl: "RUBL",
			nubl: "NUBL",
			publ: "PUBL",
			unreleased: "Unreleased",
			illegal: "Illegal",*/
			legal: "Legal",
			illegal: "Illegal",
		};
		var name = tierTable[id] || id;
		this.id = id;
		this.shortTitle = name;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/tiers/'+id+'" data-target="push" class="subtle">'+name+'</a></h1>';

		if (id === 'nfe') {
			buf += '<p>"NFE" (Not Fully Evolved) as a tier refers to NFE Pokémon that aren\'t legal in LC and don\'t make the usage cutoff for a tier such as PU.</p>';
		}

		if (id.startsWith('cap')) buf += '<div class="warning"><strong>Note:</strong> <a href="http://www.smogon.com/cap/" target="_blank">Smogon CAP</a> is a project to make up Pok&eacute;mon.</div>';

		// buf += '<p></p>';

		// pokemon
		buf += '<h3>Pok&eacute;mon in this tier</h3>';
		buf += '<ul class="utilichart nokbd">';
		buf += '</ul>';

		buf += '</div>';

		this.html(buf);

		setTimeout(this.renderPokemonList.bind(this));
	},
	renderPokemonList: function(list) {
		var tierName = this.shortTitle;
		var tierName2 = '(' + tierName + ')';
		var buf = '';
		for (var pokemonid in BattlePokedex) {
			var template = BattlePokedex[pokemonid];
			if (template.tier === tierName || template.tier === tierName2) {
				buf += BattleSearch.renderPokemonRow(template);
			}
		}
		this.$('.utilichart').html(buf);
	}
});
var PokedexArticlePanel = PokedexResultPanel.extend({
	initialize: function(id) {
		id = toID(id);
		this.shortTitle = id;

		var buf = '<div class="pfx-body dexentry">';
		buf += '<a href="/" class="pfx-backbutton" data-target="back"><i class="fa fa-chevron-left"></i> Pok&eacute;dex</a>';
		buf += '<h1><a href="/articles/'+id+'" data-target="push" class="subtle">'+id+'</a></h1>';
		buf += '<div class="article-content"><em>Loading...</em></div>';
		buf += '</div>';

		this.html(buf);

		var self = this;
		$.get('/.articles-cached/' + id + '.html').done(function (html) {
			var html = html.replace(/<h1[^>]*>([^<]+)<\/h1>/, function (match, innerMatch) {
				self.shortTitle = innerMatch;
				self.$('h1').first().html('<a href="/articles/' + id + '" class="subtle" data-target="push">' + innerMatch + '</a>');
				return '';
			});
			self.$('.article-content').html(html);
		});
	}
});
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

		setTimeout(this.renderLocationList.bind(this));
	},
	renderLocationList: function() {
		var encounters = JSON.parse(localStorage.encounters);

		function updateEncounters() {
			var sublocations = [];
			for (var locationid in BattleLocationDex) {
				if (encounters[locationid]) {
					BattleLocationDex[locationid].taken = BattlePokedex[encounters[locationid]] ? BattlePokedex[encounters[locationid]].name : "Missed";
					if (BattleLocationDex[locationid].sublocations) {
						sublocations = BattleLocationDex[locationid].sublocations;
						for (var i in BattleLocationDex[locationid].sublocations)
							BattleLocationDex[sublocations[i]].taken = BattlePokedex[encounters[locationid]] ? BattlePokedex[encounters[locationid]].name : "Missed";
					}
				} else if (sublocations.includes(locationid)) {
					continue;
				} else if (BattleLocationDex[locationid].taken) {
					BattleLocationDex[locationid].taken = false;
					if (BattleLocationDex[locationid].sublocations) {
						sublocations = BattleLocationDex[locationid].sublocations;
						for (var i in BattleLocationDex[locationid].sublocations)
							BattleLocationDex[sublocations[i]].taken = false;
					}
				}
			}
			localStorage.encounters = JSON.stringify(encounters);
		}

		function updateRows() {
			var buf = '';
			var seen = [];
			for (var locationid in BattleLocationDex) {
				var location = BattleLocationDex[locationid];
				var cleanName = BattleLocationDex[locationid].name.split(' -')[0];
				if (!seen.includes(cleanName)) {
					buf += `<li class="result" data-locationid="${toID(cleanName)}"><a href="/locations/${locationid}" data-target="push"><span class="col locationnamecol">${cleanName}</span>`;
					buf += '<span class="col dropdowncol">';
					buf += '<select class="dropdown" data-locationid="' + locationid + '" style="width: 100%;">';
					buf += '<option value="none">(None)</option>';
					buf += `<option value="missed"${location.taken && location.taken == 'Missed' ? ' selected="selected"' : ''}>(Missed)</option>`;
					var encounters = location.encounters;
					var encounterList = [];
					if (encounters) {
						buf += '<optgroup label="Route encounters">';
						for (var i in encounters) {
							var encounter = encounters[i];
							var id = encounter.substr(10);
							if (encounterList.includes(id)) continue;
							encounterList.push(id);
							var pokemon = BattlePokedex[id];
							buf += `<option value="${id}"${location.taken && toID(location.taken) == id ? ' selected="selected"' : ''}>${pokemon.name}</option>`;
						}
						buf += '</optgroup>';
						buf += '<optgroup label="Other">';
					}
					for (var id in BattlePokedex) {
						if (encounterList.includes(id)) continue;
						var pokemon = BattlePokedex[id];
						if (!pokemon.baseSpecies || pokemon.baseSpecies == pokemon.name) buf += `<option value="${id}"${location.taken && toID(location.taken) == id ? ' selected="selected"' : ''}>${pokemon.name}</option>`;
					}
					if (encounters) buf += '</optgroup>';
					buf += '</select>';
					buf += '</span>';
					if (location.taken) {
						buf += '<span class="col iconcol">';
						buf += '<span style="' + Dex.getPokemonIcon(location.taken) + '"></span>';
						buf += '</span> ';
					}
					buf += '</a></li>';
					seen.push(`${cleanName}`);
				}
			}
			this.$('.resultchart').html(buf);
			$('.dropdown').select2();
			setInputEvents();
		}
		updateRows();

		function setInputEvents() {
			$('.select2-selection').click(function() {
				return false;
			});
			$(".dropdown").change(function() {
				var id = $(this).val();
				if (id == 'none') {
					delete encounters[$(this).attr("data-locationid")];
					$(this).parent().siblings(".iconcol").remove();
					updateEncounters();
				} else {
					encounters[$(this).attr("data-locationid")] = toID(id);
					$(this).parent().siblings(".iconcol").remove();
					var html = '<span class="col iconcol">';
					html += '<span style="' + Dex.getPokemonIcon(id) + '"></span>';
					html += '</span> ';
					$(this).parent().after(html);
					updateEncounters();
				}
			});
		}
		
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
					if (row.includes('Location: ')) location = row.split('Location: ')[1];
				}
				var speciesid = toID(species);
				var locationid = toID(location);
				if (!Object.keys(BattleLocationDex).includes(locationid) || !Object.keys(BattlePokedex).includes(speciesid)) {
					alert("No sets imported, please check your syntax and try again");
					return;
				}
				sets[locationid] = speciesid;
				addedpokes++;
			}
			if (sets && addedpokes) {
				jQuery.extend(encounters, sets);
				localStorage.encounters = JSON.stringify(encounters);
				updateEncounters();
				updateRows();
			} else {
				alert("No sets imported, please check your syntax and try again");
			}
		});

		this.$('#reset-btn').click(function() {
			encounters = {};
			updateEncounters();
			updateRows();
		});

		this.$('#help-btn').click(function() {
			alert("This page tracks your encounters and marks dupes across the dex. Pastes imported here are separate from ones imported into the calculator.\n\n" +
				  "You will need a modified Lua script to import the correct data, you can download it using the \"Lua Script\" button.");
		});

		this.$('#lua-btn').click(function() {
			window.open("https://gist.github.com/anastarawneh/aa5f406ba474325b7c49e869a891c5b4#file-ek-modified-lua");
		});
	}
});
