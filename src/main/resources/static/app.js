var stompClient = null;
var interval = null;
var swicht = 0;
var alertas = [];
var anio = (new Date).getFullYear();


function setConnected(connected) {
	$("#connect").prop("disabled", connected);
	$("#disconnect").prop("disabled", !connected);
	$("#send").prop("disabled", !connected);

	if (connected) {
		$("#footer").html(anio + " Copyright: ")
		$("#conversation").show();
		$("#connect").removeClass("btn-light").addClass("btn-success");
		disableInput(0);

	}
	else {
		$("#conversation").hide();
		$("#alertas").hide();
		$("#connect").removeClass("btn btn-success").addClass("btn btn-light");
		$("#email").val("")

	}
	$("#greetings").html("");
}

function connect() {

	//var socket = new SockJS('https://sgtasec.herokuapp.com/stomp-endpoint');
	var socket = new SockJS('localhost:9090/stomp-endpoint');

	stompClient = Stomp.over(socket);
	stompClient.connect({}, function(frame) {
		setConnected(true);
		stompClient.subscribe('/topic/greetings', function(greeting) {
			// test send meesage to server	
			if (greeting.body == 'email_vacio') {
				sendName();

			} else {
				
				let objJson = JSON.parse(greeting.body);
	
				if (objJson.atencion != null) {					
					if (objJson.atencion.turno.estado === 1) {
						showGreeting(objJson);
						// manejar desconectar boton enviar y input email
						if (swicht == 0) {
							disableInput(1);
						}					
					}
					
					if (objJson.atencion.turno.estado === 2) {
						turnoEnAtencion();
					}

					if (objJson.atencion.turno.estado === 3) {
						limpiarDatos();
						turnoConAtencionFinalizada(objJson);						
					}
				} else {
					limpiarDatos();
					$("#turno").text('Su correo no registra un turno, pendiente de atenci\u00F3n.');
				}
			}
		});
	});
}

function turnoEnAtencion() {
	sessionStorage.setItem('seg', 0);
	$("#alertas").hide();
	$("#contadorLlamados").text('El turno está en atención');
}

function turnoConAtencionFinalizada(msg) {
	$("#contadorLlamados").text('A finalizado la atención del turno ' + msg.atencion.turno.turnoAtencion + ' para ' + msg.emailRecibido );
}

function disconnect() {
	
	 Swal.fire({
	  title: '¡Atención!',
	  text: "Al desconectarse, el conteo regresivo que muestra el tiempo estimado para su atención, será reiniciado.",
	  icon: 'warning',
	  showCancelButton: true,
	  confirmButtonColor: '#3085d6',
	  cancelButtonColor: '#d33',
	  confirmButtonText: 'Si, desconectar!'
	}).then((result) => {
	  if (result.isConfirmed) {
		
	    		if (stompClient !== null) {
				stompClient.disconnect();
				clearInterval(interval);
				sessionStorage.clear();
				//limpiar datos mostrados
				limpiarDatos();
				disableInput(1);
			}
			setConnected(false);
	  } 
	})

}


function sendName() {
	let mailCliente = $("#email").val().trim();
	
	if (mailCliente == "") {
		Swal.fire({
			icon: 'error',
			text: 'El campo Mail es obligatorio!',
			footer: 'Verifique el ingreso del Mail registrado'
		});
	} else {
		if (validaEmail(mailCliente)) {
			stompClient.send("/app/atencion", {}, JSON.stringify({ 'email': mailCliente }));
			swicht = 0;
		} else {
			Swal.fire({
				icon: 'error',
				text: 'Favor verifique el ingreso de Mail!',
				footer: 'Verifique el ingreso del Mail registrado'
			});
		}
	}
}
function validaEmail(email) {
	var regex = /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
	return regex.test(email) ? true : false;
}


function showGreeting(message) {
	let mailCliente = $("#email").val().trim();

	if (message.emailRecibido == mailCliente) {
		// Muestra si pudo recuperar un turno
		if (message.atencion != null) {
			$("#turno").text('Turno ' + message.atencion.turno.turnoAtencion);
			let contLlamados = message.atencion.contadorLlamados;
			
			if(contLlamados >= 1) {				
				let llamados = 'Su turno ha sido llamado(a) ';
				llamados +=  (contLlamados == 1) ? (contLlamados + " Vez") : contLlamados + " Veces";
				$("#contadorLlamados").text(llamados);
			}
			
			clearInterval(interval);

			if (message.tiempoEstimadoParaAtencion != null) {

				if (sessionStorage.getItem('seg') === null) {
					sessionStorage.setItem('seg', minutesToSeconds(message.tiempoEstimadoParaAtencion));

				} else if (sessionStorage.getItem('seg') > minutesToSeconds(message.tiempoEstimadoParaAtencion)) {
					sessionStorage.setItem('seg', minutesToSeconds(message.tiempoEstimadoParaAtencion));
				}
				
				$("#alertas").show();
				//Alertas
				alertas = message.alertas;
				//Activar conteo regresivo		
				interval = setInterval(descontarSegundos, 1000);

			} else {
				// Tiempo de espera completado
				$("#tiempoEstimadoParaAtencion").css("background-color", "yellow");
				$("#tiempoEstimadoParaAtencion").text('Su tiempo de espera ha finalizado.');
			}
		}
	}
}

$(function() {
	$("#alertas").hide();
		
	$("form").on('submit', function(e) {
		e.preventDefault();
	});
	$("#connect").click(function() { connect(); });
	$("#disconnect").click(function() { disconnect(); });
	$("#send").click(function() { sendName(); });
	$("#conversation").hide();
	$("#alertas").hide();
	disableInput(1);

});

function limpiarDatos() {
	$("#email").val('');
	$("#turno").text('');
	$("#tiempoEstimadoParaAtencion").text('');
	$("#conteoRegresivo").text('');
	$("#seccion-alerta").css("background-color", "#fff");
	$("#alerta").text('');
	$("#contadorLlamados").text('');
}

function descontarSegundos() {
	var seconds = sessionStorage.getItem('seg');
	sessionStorage.setItem('seg', seconds - 1);
	//sección superior, conteo regresivo
	$("#conteoRegresivo").text('Tiempo de espera estimado: ' + secondsToHourAndMinutes(sessionStorage.getItem('seg')));
	//Buscar alertas
	manejoAlertas();

	if (sessionStorage.getItem('seg') <= 0) {
		clearInterval(interval);
		sessionStorage.clear();
	}
}

function manejoAlertas() {
	let alerta = [];
	// Manejo de Alertas, duracion Desde y duracionHasta expresados en minutos
	alerta = alertas.filter(function(el) {
		return ((Math.floor(sessionStorage.getItem('seg') / 60) >= el.duracionDesde) && (Math.floor(sessionStorage.getItem('seg') / 60) <= el.duracionHasta));
	});

	if (alerta.length == 1) {
		$("#seccion-alerta").css("background-color", alerta[0].colorHtml);
		$("#alerta").text(alerta[0].descripcion);
	}
}

function minuteToHourAndMinutes(minutes) {
	var respuesta = '';
	var total = minutes;
	var hrs = Math.floor(total / 60); // Horas.
	var min = total % 60; // Minutos.
	if (hrs > 0) {
		respuesta += hrs;
		respuesta += ((hrs > 1) ? ' Horas' : ' Hora');
		if (min > 0) {
			respuesta += " y ";
		}
	}

	if (min > 0) {
		respuesta += min;
		respuesta += ((min > 1) ? ' Minutos' : ' Minuto');
	}
	return respuesta;
}

function secondsToHourAndMinutes(seconds) {
	var respuesta = '';
	var minutes = Math.floor(seconds / 60);
	var total = minutes;
	var hrs = Math.floor(total / 60); // Horas.
	var min = total % 60; // Minutos.
	var sec = seconds % 60; //Segundos 

	if (hrs > 0) {
		respuesta += hrs + ' ' + ((hrs > 1) ? ' Horas' : ' Hora');
		if (min > 0) { respuesta += " y "; }
	}

	if (min > 0) {
		respuesta += min + ' ' + ((min > 1) ? ' Minutos ' : ' Minuto ');
	}

	if (sec > 0) {
		respuesta += sec + ' ' + ((sec > 1) ? ' Segundos' : ' Segundo');
	}
	return respuesta;
}

function minutesToSeconds(minutes) {
	var min = parseInt(minutes, 10);
	min = (min > 0) ? min : 0;
	var segundos = Math.floor(min * 60); // Segundos.
	return segundos;
}

//funciones Jaime Alarcon
function disableInput(swich) {
	if (swich == 1) {
		$("#email").attr('disabled', 'disabled');
		$("#send").attr('disabled', 'disabled');
	} else {
		$("#email").removeAttr('disabled');
		$("#send").removeAttr('disabled');
	}
}