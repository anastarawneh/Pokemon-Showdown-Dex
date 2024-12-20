var Pokedex = Panels.App.extend({
	topbarView: Topbar,
	backButtonPrefix: '<i class="fa fa-chevron-left"></i> ',
	states2: {
		'pokemon/:pokemon': PokedexPokemonPanel,
		'moves/:move': PokedexMovePanel,
		'items/:item': PokedexItemPanel,
		'abilities/:ability': PokedexAbilityPanel,
		'types/:type': PokedexTypePanel,
		'categories/:category': PokedexCategoryPanel,
		'tags/:tag': PokedexTagPanel,
		'egggroups/:egggroup': PokedexEggGroupPanel,
		'tiers/:tier': PokedexTierPanel,
		'articles/:article': PokedexArticlePanel,
		'locations/:location': PokedexLocationPanel,

		'': PokedexSearchPanel,
		'pokemon/': PokedexSearchPanel,
		'moves/': PokedexSearchPanel,
		'locations/': PokedexSearchPanel,
		':q': PokedexSearchPanel,
		'encounters': PokedexEncountersPanel,
		'encounters/': PokedexEncountersPanel
	},
	initialize: function() {
		this.routePanel('*path', PokedexSearchPanel); // catch-all default

		for (var i in this.states2) {
			this.routePanel(i, this.states2[i]);
		}

		if (localStorage.encounters) {
			var encounters = JSON.parse(localStorage.encounters);
			for (var locationid in encounters) {
				if (encounters[locationid]) {
					BattleLocationDex[locationid].taken = BattlePokedex[encounters[locationid]] ? BattlePokedex[encounters[locationid]].name : "Missed";
					if (BattleLocationDex[locationid].sublocations) {
						var sublocations = BattleLocationDex[locationid].sublocations;
						for (var i in BattleLocationDex[locationid].sublocations)
							sublocations[i]; // I have no idea why, but everything breaks if this isn't referenced.
							BattleLocationDex[sublocations[i]].taken = BattlePokedex[encounters[locationid]] ? BattlePokedex[encounters[locationid]].name : "Missed";
					}
				}
			}
		} else {
			localStorage.encounters = '{}';
		}
	}
});
var pokedex = new Pokedex();
