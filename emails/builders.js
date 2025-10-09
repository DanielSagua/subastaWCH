// /emails/builders.js

function clp(n) {
  if (n === null || n === undefined) return '';
  return `$${Number(n).toLocaleString('es-CL')}`;
}

/** 1) Aviso: nuevo producto publicado (a todos los usuarios activos) */
function tplNuevoProducto({ nombreUsuario, nombreProducto, urlProducto }) {
  const subject = '🆕 Nuevo producto en subasta';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>El Administrador ha publicado un nuevo articulo en Subastas WCH.<br>
      El nombre del producto es <b>${nombreProducto}</b>.<br>
      Se el primero en ofertar haciendo clic en el siguiente boton!</p>

      <p style="margin:16px 0;">
        <a href="${urlProducto}" 
           style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #005387;">
          Ve el nuevo producto
        </a>
      </p>

      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Atentamente,<br>Equipo de WEG Subastas</small>
    </div>
  `;
  return { subject, html };
}

/** 2) Aviso: subasta cancelada (a los ofertantes) */
function tplSubastaCancelada({ nombreUsuario, nombreProducto }) {
  const subject = '❌ Subasta cancelada';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>La subasta del producto <b>${nombreProducto}</b> fue cancelada.</p>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
    </div>
  `;
  return { subject, html };
}

/** 3) Confirmación: oferta registrada (al ofertante actual) */
function tplOfertaRegistrada({ nombreUsuario, monto, nombreProducto, urlProducto }) {
  const subject = `✅ Oferta registrada en ${nombreProducto}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Estimado ${nombreUsuario},</p>
      <p>Tu oferta de <b>$${monto}</b> fue realizada con éxito en el producto: <b>${nombreProducto}</b>.</p><br>
      <br>
            <i><p>Agradecemos considerar lo siguiente:</p>

<p>•	Si eres el ganador, te haremos llegar toda la información a tu correo electrónico.<br>
•	En caso de que tu apuesta sea superada, se te notificará a tu correo electrónico.<br>
•	Si eres el ganador/a, tienes 24 horas para realizar el pago o de lo contrario, el producto vuelve a ser ofertado en nuestra plataforma.</p></i>

      <p style="margin:16px 0;">
        <a href="${urlProducto}" 
           style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #0d6efd;">
          Ver producto
        </a>
      </p>

      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Atentamente,<br>Equipo de WEG Subastas</small>
    </div>
  `;
  return { subject, html };
}


/** 4) Aviso: has sido superado (al ofertante anterior) */
function tplHasSidoSuperado({ nombreUsuario, nombreProducto, urlProducto }) {
  const subject = `⚠️ Te han superado en ${nombreProducto}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>Otro participante ha superado tu oferta en el producto <b>${nombreProducto}</b>.</p>

      <p style="margin:16px 0;">
        <a href="${urlProducto}" 
           style="display:inline-block;padding:10px 16px;text-decoration:none;border-radius:6px;border:1px solid #dc3545;">
          Ver producto
        </a>
      </p>

      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
    </div>
  `;
  return { subject, html };
}


/** 5) Aviso: ganaste la subasta (al ganador) */
function tplGanasteSubasta({ nombreUsuario, nombreProducto }) {
  const subject = '🎉 Has ganado la subasta';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>Has ganado la subasta del producto <b>${nombreProducto}</b>.</p>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
    </div>
  `;
  return { subject, html };
}

/** 6) Aviso: subasta finalizada (a participantes que no ganaron) */
function tplSubastaFinalizadaParaParticipante({ nombreUsuario, nombreProducto }) {
  const subject = '📢 Subasta finalizada';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>La subasta del producto <b>${nombreProducto}</b> ha finalizado. Gracias por participar.</p>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
    </div>
  `;
  return { subject, html };
}

/** 7) Aviso: subasta finalizada (al administrador) */
function tplSubastaFinalizadaAdmin({ nombreProducto, nombreGanador }) {
  const subject = '📬 Subasta finalizada';
  const ganadorTxt = nombreGanador
    ? ` Ganador: ${nombreGanador}`
    : ' Sin ganador.';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>La subasta <b>${nombreProducto}</b> ha finalizado.${ganadorTxt}</p>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
    </div>
  `;
  return { subject, html };
}


module.exports = {
  tplNuevoProducto,
  tplSubastaCancelada,
  tplOfertaRegistrada,
  tplHasSidoSuperado,
  tplGanasteSubasta,
  tplSubastaFinalizadaParaParticipante,
  tplSubastaFinalizadaAdmin,
};
