$(document).ready(function(){
	//League data from server
	var table = $('#leaguetable').DataTable({
		"processing": true,
		"ajax": "sendleague",
		"iDisplayLength": 100,
		"order": [[ 8, 'desc' ],[7, 'desc' ] ], //sort by points, then GD
		"aoColumnDefs": [
			{ "sClass": "photo-column", "aTargets": [ 0 ] },
			{ "sClass": "user-column", "aTargets": [ 1 ] },
			{ "sClass": "company-column", "aTargets": [ 2 ] }
		],    
		"bLengthChange": false,
		"columns": [
			{ data: 'photo' },
			{ data: 'name' },
			{ data: 'company' },
			{ data: 'games' },
			{ data: 'wins' },
			{ data: 'loses' },
			{ data: 'goalsAndAgainstgoals' },
			{ data: 'goaldif' },
			{ data: 'points' }
		],
		"fnDrawCallback" : function() {
			$(".photo-column > img").attr('height','100');
		}
	}); 
	
	setInterval( function () {
 		table.ajax.reload();
		console.log("that reload_raw");
	}, 30000 );

	$('#leaguetable tbody').on( 'click', 'tr', function () {
		console.log( table.row( this ).data() );
	});

	$.fn.dataTable.ext.errMode = 'throw';

});   



