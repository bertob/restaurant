var $container = $("#table"),
	$order = $("#order-area"),
	overlapThreshold = "30%",
	transfX = 0,
	transfY = 0,
	absX = 0,
	absY = 0,
	imgScale = 1,
	modalOpen = false,
	totalSum = 0,
	orderedDishes = [],
	globalSection = "table";

var centerOffsets = [
	[245, 70],
	[100, 260],
	[-120, 260],
	[-255, 70],
	[0, 0],
];

// initialize app
$(document).ready(function() {
	$.getJSON("dishes.json", function(data) {
		renderDishes(data);
		flkty.select(0);
	});
});

var surprise = null;
var template = null;
function renderDishes(data) {
	surprise = data.surprise;
	var dishes = [data.starters, data.main, data.dessert, data.drinks];
	template = $(".dish-template").clone().removeClass("dish-template").css("opacity", 1);
	$("#move-container").find(".dish.unchanged").remove();
	$("#dishes-container").find(".dish").not(".dish-template").remove();
	$(".dish-template").css("opacity", 0);
	for (var d = 0; d < dishes.length; d++) {
		for (var i = 0; i < Math.min(dishes[d].length, 4); i++) {
			var dish = dishes[d][i];
			var node = template.clone();
			node.addClass("dish-" + ((i % 4) + 1));
			node.attr({
				"data-refnumber": dish.refNumber,
				"data-position": (i % 4),
				"data-price": dish.price
			});
			node.find(".name, .title").text(dish.name);
			node.find(".price").text(formatPrice(dish.price));
			node.children(".image").attr("src", dish.image);
			node.find(".description").text(dish.description);
			if (!dish.healthy)
				node.find(".healthy").hide();
			var str = "";
			for (var j = 0; j < dish.ingredients.length; j++) {
				var ingr = dish.ingredients[j].name;
				if (ingr === undefined) ingr = dish.ingredients[j];
				str += ingr + "<br>";
			}
			if (dish.ingredients.length > 5) {
				node.find("ul").addClass("ingredient-columns");
			}
			if (dish.dishType === "Drink") {
				node.addClass("drink");
				node.find(".ingredient-list").remove();
			}
			node.find("ul").append(str);
			node.appendTo("#dishes-" + (d + 1));
		}
	}
}

/* GLOBAL NAVIGATION */
$("#order-button").click(function() {
	if (globalSection === "table") {
		$("#surprise-button").addClass("inactive");
		$("#order-button").text("Order more");
		goTo("ordered");
	} else {
		$("#surprise-button").removeClass("inactive");
		$("#order-button").text("Update order");
		goTo("table");
	}
});

function goTo(section) {
	globalSection = section;
	var y = 0;
	switch (section) {
		case "table":
			y = 0;
			$("#order-label").removeClass("hidden");
			break;
		case "ordered":
			y = -506;
			$("#order-label").addClass("hidden");
			break;
		default:
			y = 0;
	}
	TweenLite.to($("#container > *"), 0.35, {
		transform: "translateY(" + y + "px)",
		ease: Back.easeInOut.config(0.5, 1.2)
	});
}

/* CATEGORY NAVIGATION */
$(".category-button").on("click", function() {
	var i = $(this).get(0).dataset.category;
	flkty.select(i);
});

/* CAROUSEL */
var flkty = new Flickity(".dishes-container", {
	initialIndex: 0,
	draggable: false,
	selectedAttraction: 0.4,
	friction: 1.3
});
flkty.on("cellSelect", function() {
	$(".move-container").children(".unchanged").remove();
	$(".dishes-group").children(".dish").show();
	$(".category-button").removeClass("active");
	$("#category-" + flkty.selectedIndex).addClass("active");
});
flkty.on("settle", function() {
	if (globalSection === "table")
		dragGroup(flkty.selectedElement);
});

/* MOVE LAYER */
function dragGroup(elem) {
	var list = $(elem).children(".dish").not(".dish-template");
	list.each(function(i, el) {
		makeDraggable(el, false);
	});
}

function makeDraggable(elem, startHidden) {
	var cont = document.getElementById("container").getBoundingClientRect();
	$(elem).show();
	var rect = elem.getBoundingClientRect();
	var l = rect.left - cont.left;
	var t = rect.top - cont.top;
	var node = $(elem).clone();
	var randomId = "id_" + Math.round(Math.random() * 10000000);
	node.attr("id", randomId);
	node.css({
		"left": l,
		"top": t,
	});
	node.addClass("unchanged").removeClass("dish-1 dish-2 dish-3 dish-4");
	node.appendTo(".move-container");
	$(elem).hide();
	if (startHidden) {
		var i = elem.dataset.position;
		node.css({
			"left": l + centerOffsets[i][0],
			"top": t + centerOffsets[i][1] - 50,
			"opacity": 0,
		});
		node.children(".image").css({
			"transform": "scale(0)"
		});
		TweenLite.to(node.get(0), 0.6, {
			left: l,
			top: t,
			opacity: 1,
			ease: Back.easeInOut.config(1.4, 1.9)
		});
		TweenLite.to(node.children(".image"), 0.6, {
			transform: "scale(1)",
			ease: Quad.easeOut
		});
	}
	update("#" + randomId, elem, true);
}

//the update() function is what creates the Draggable according to the options selected (snapping).
function update(elementId, originalElem, refill) {
	var image = $(elementId).children(".image")[0];
	var modal = $(elementId).children(".modal")[0];
	var refnum = parseInt($(elementId).attr("data-refnumber"));

	var draggable = Draggable.create(elementId, {
		bounds: $container,
		// trigger: image,
		edgeResistance: 0.9,
		type: "x,y",
		throwProps: true,
		autoScroll: true,
		liveSnap: false,
		minimumMovement: 10,
		snap: {
			x: function(endValue) {
				var i = parseInt(this._eventTarget.dataset.position);
				var s = this._eventTarget.dataset.state;
				if (s !== "ordered") {
					// dish has not been ordered yet; snap back into position
					if (this.hitTest($order, overlapThreshold)) {
						addToOrder(refnum);
						return endValue;
					} else {
						$(elementId).removeClass("small");
						return 0;
					}
				} else {
					// dish has been ordered; snap to middle button to delete
					if (this.hitTest($order, overlapThreshold)) {
						return endValue;
					} else {
						removeFromOrder(refnum);
						return centerOffsets[i][0];
					}
				}
			},
			y: function(endValue) {
				var i = parseInt(this._eventTarget.dataset.position);
				var s = this._eventTarget.dataset.state;
				var price = this._eventTarget.dataset.price;
				if (s !== "ordered") {
					// dish has not been ordered yet; snap back into position
					if (this.hitTest($order, overlapThreshold)) {
						$(elementId).removeClass("unchanged");
						$(elementId).attr("data-state", "ordered");
						addToSum(price);
						hideOrderHelp();
						if (refill) makeDraggable(originalElem, true);
						return 550;
					} else {
						return 0;
					}
				} else {
					// dish has been ordered; snap to middle button to delete
					if (this.hitTest($order, overlapThreshold)) {
						return 550;
					} else {
						TweenLite.to(image, 0.4, {
							opacity: 0,
							transform: "scale(0.4)",
							ease: Quad.easeOut
						});
						subtractFromSum(price);
						setTimeout(function() {
							$(elementId).remove();
						}, 2000);
						return centerOffsets[i][1] - 50;
					}
				}
			}
		}
	})[0];

	draggable.addEventListener("dragstart", function() {
		if ($(elementId).hasClass("unchanged")) {
			$(elementId).addClass("small");
			TweenLite.to(image, 0.2, {
				transform: "scale(0.75) translate(0px, 0px)",
				ease: Quad.easeOut
			});
			if ($(elementId).hasClass("modal-open")) {
				modalOpen = false;
				$(elementId).removeClass("modal-open");
				TweenLite.to(modal, 0.2, {
					transform: "scale(0.0001)",
					ease: Quad.easeOut
				});
				TweenLite.to($(elementId).get(0), 0.2, {
					left: absX,
					top: absY,
					transform: "translate(" + transfX + "px, " + transfY + "px)",
					ease: Quad.easeOut
				});

			}
		}
	});

	draggable.addEventListener("dragend", function() {
		if ($(elementId).hasClass("unchanged") && !$(elementId).hasClass(
				"modal-open")) {
			$(elementId).removeClass("small");
			TweenLite.to(image, 0.2, {
				transform: "scale(1)",
				ease: Quad.easeOut
			});
		}
	});

	draggable.addEventListener("click", function() {
		if (!modalOpen && globalSection === "table") {
			// modal closed, open it
			modalOpen = true;
			$(elementId).addClass("modal-open");
			draggable.disable();
			transfX = draggable.x;
			transfY = draggable.y;
			absX = $(elementId).css("left");
			absY = $(elementId).css("top");
			if ($(elementId).hasClass("small")) imgScale = 0.75;
			else imgScale = 1;
			TweenLite.to($(elementId).get(0), 0.4, {
				left: "110px",
				top: "70px",
				transform: "translate(0px, 0px)",
				ease: Back.easeInOut.config(1.4, 1.9)
			});
			TweenLite.to(modal, 0.4, {
				transform: "scale(1)",
				ease: Back.easeInOut.config(1.4, 1.9)
			});
			TweenLite.to(image, 0.4, {
				transform: "scale(2) translate(200px, 20px)",
				ease: Back.easeInOut.config(1.4, 1.9)
			});
		}
	});
	$(elementId).find(".close-button").click(function() {
		modalOpen = false;
		draggable.enable();
		$(elementId).removeClass("modal-open");
		TweenLite.to($(elementId).get(0), 0.4, {
			left: absX,
			top: absY,
			transform: "translate(" + transfX + "px, " + transfY + "px)",
			ease: Back.easeInOut.config(1.3, 1.4)
		});
		TweenLite.to(modal, 0.4, {
			transform: "scale(0.0001)",
			ease: Back.easeInOut.config(1.4, 1.9)
		});
		TweenLite.to(image, 0.4, {
			transform: "scale(" + imgScale + ") translate(0px, 0px)",
			ease: Back.easeInOut.config(1.1, 1.2)
		});
	});
}

$("#surprise-button").click(function() {
	var orderedDishes = $(".move-container").find("*[data-state='ordered']");
	var timeout = orderedDishes.length * 80;
	subtractFromSum(totalSum);
	hideOrderHelp();
	for (var i = 0; i < orderedDishes.length; i++) {
		removeOrderedDish(orderedDishes[i]);
	}

	function removeOrderedDish(dish) {
		var i = parseInt(dish.dataset.position);
		TweenLite.to($(dish).get(0), 0.3, {
			opacity: 0,
			transform: "translate(" + centerOffsets[i][0] + "px, " +
				centerOffsets[i][1] + "px) scale(0.5)",
			ease: Quad.easeOut
		});
		setTimeout(function() {
			$(dish).remove();
		}, 2000);
	}

	setTimeout(function() {
		createSurprise(-180, 0);
		setTimeout(function() {
			createSurprise(0, 1);
			setTimeout(function() {
				createSurprise(180, 2);
			}, 150);
		}, 150);
	}, timeout);

	function createSurprise(xOffset, i) {
		var node = $("#surprise-template").clone();
		var randomId = "id_" + Math.round(Math.random() * 10000000);
		node.attr({
			"id": randomId,
			"data-refnumber": surprise[i].refNumber,
			"data-state": "ordered",
			"data-price": surprise[i].price
		});
		addToSum(surprise[i].price);
		addToOrder(surprise[i].refNumber);
		node.show();
		node.css({
			"left": "370px",
			"top": "290px",
			"opacity": 0,
		});
		node.appendTo(".move-container");
		node.children(".image").css({
			"transform": "scale(0.2)"
		});
		TweenLite.to(node.get(0), 0.4, {
			transform: "translate(" + xOffset + "px, 210px)",
			opacity: 1,
			ease: Back.easeInOut.config(1.4, 1.9)
		});
		TweenLite.to(node.children(".image"), 0.4, {
			transform: "scale(0.75)",
			ease: Back.easeInOut.config(1.4, 1.9)
		});
		update("#" + randomId, null, false);
	}
});

function hideOrderHelp() {
	TweenLite.to($(".order-help"), 0.4, {
		transform: "scale(0.2) translate(0, 50px)",
		opacity: 0
	});
}

function addToOrder(id) {
	orderedDishes.push(id);
}

function removeFromOrder(id) {
	var index = orderedDishes.indexOf(id);
	if (index > -1) {
		orderedDishes.splice(index, 1);
	}
}

function addToSum(price) {
	totalSum += parseFloat(price);
	$("#order-label").text("Your order: " + formatPrice(totalSum));
	if (totalSum > 0)
		$("#order-button").removeClass("inactive");
}

function subtractFromSum(price) {
	totalSum -= parseFloat(price);
	$("#order-label").text("Your order: " + formatPrice(totalSum));
	if (totalSum === 0)
		$("#order-button").addClass("inactive");
}

function formatPrice(num) {
	return (num / 100).toLocaleString('de-DE', {
		style: 'currency',
		currency: 'EUR',
		minimumFractionDigits: 2
	});
}
