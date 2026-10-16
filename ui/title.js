var introhtml;
// Animation state for the title colors. This used to live on the #intromenu element itself,
// reached through the browser's id-to-global shortcut, which tied this file to the site's HTML.
const titleState = { colorIndex: 0, colorEffect: 0 };
const titleColors = ['pink','red','orange','yellow','greenyellow','green','limegreen','cyan','blue','purple','violet'];

function startTitleColor() {
	titleState.colorIndex = 0;
	titleState.colorEffect = Math.floor(Math.random() * 5);
	if (introhtml.colorTimer){
		clearInterval(introhtml.colorTimer);
	}
	introhtml.colorTimer = setInterval(loopTitleColor, 200);
	for (var i =0; i < 11; ++i) {
		$("#T"+i).css({"color": 'white'});
	}
}

function loopTitleColor() {
	++titleState.colorIndex;
	switch (titleState.colorEffect){
		case 0:
			for (var i = titleState.colorIndex - 1, j = 0; i >= 0 && j <= 5; --i, ++j) {
				var color = (i >= titleColors.length) ? 'white' :  titleColors[i];
				$("#T"+(5+j)).css({"color": color}) ;
				$("#T"+(5-j)).css({"color": color});
			}
			if (titleState.colorIndex >= (1 + 5 + titleColors.length)) {
				titleState.colorIndex = 0;
			}
			break;
		case 1:
			for (var i = titleState.colorIndex - 1, j = 10; i >= 0 && j >= 0; --i, --j) {
				var color = (i >= titleColors.length * 2) ? 'white' :  titleColors[Math.floor(i / 2)];
				$("#T"+(j)).css({"color": color}) ;				
			}
			if (titleState.colorIndex >= (11 + titleColors.length * 2)) {
				titleState.colorIndex = 0;
			}
			break;
		case 2:
			for (var i = titleState.colorIndex - 1, j = 0; i >= 0 && j <= 10; --i, ++j) {
				var color = (i >= titleColors.length * 2) ? 'white' :  titleColors[Math.floor(i / 2)];
				$("#T"+(j)).css({"color": color}) ;				
			}
			if (titleState.colorIndex >= (11 + titleColors.length * 2)) {
				titleState.colorIndex = 0;
			}
			break;
		case 3:
			var i = titleState.colorIndex * 4, j = i % 11;
			var color = (titleState.colorIndex > titleColors.length) ? 'white' :  titleColors[j];
			$("#T"+(j)).css({"color": color}) ;				
			if (titleState.colorIndex > (2 * titleColors.length)) {
				titleState.colorIndex = 0;
			}
			break;
		default:
			for (var i = titleState.colorIndex - 1, j = 5; i >= 0 && j >= 0; --i, --j) {
				var color = (i >= titleColors.length) ? 'white' :  titleColors[i];
				$("#T"+(5+j)).css({"color": color}) ;
				$("#T"+(5-j)).css({"color": color});
			}
			if (titleState.colorIndex >= (1 + 5 + titleColors.length)) {
				titleState.colorIndex = 0;
			}
			break;
	}
	if (titleState.colorIndex == 0) {
		titleState.colorEffect = Math.floor(Math.random() * 5);
	}
}

function startTitle() {
	introhtml = $('#intromenu');	
	startTitleColor();
}

function stopTitle() {
    if (introhtml.colorTimer) {
		clearInterval(introhtml.colorTimer);
		introhtml.colorTimer = null;
	}
}
