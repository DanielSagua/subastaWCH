// /emails/builders.js

function clp(n) {
    if (n === null || n === undefined) return '';
    return `$${Number(n).toLocaleString('es-CL')}`;
}

/** 1) Aviso: nuevo producto publicado (a todos los usuarios activos) */
function tplNuevoProducto({ nombreUsuario }) {
    const subject = '🆕 Nuevo producto en subasta';
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>Se ha publicado un nuevo producto. ¡Revísalo en el sistema!</p>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
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
function tplOfertaRegistrada({ nombreUsuario, monto, nombreProducto }) {
    const subject = '📝 Oferta registrada';
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>Tu oferta de <b>${clp(monto)}</b> fue registrada en el producto <b>${nombreProducto}</b>.</p>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
      <small>Subastas WCH</small>
    </div>
  `;
    return { subject, html };
}

/** 4) Aviso: has sido superado (al ofertante anterior) */
function tplHasSidoSuperado({ nombreUsuario, nombreProducto }) {
    const subject = '📉 Has sido superado en una subasta';
    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#222;">
      <p>Hola ${nombreUsuario},</p>
      <p>Tu oferta ya no es la más alta en el producto <b>${nombreProducto}</b>.</p>
      <p>¡Haz tu mejor oferta para recuperar el liderazgo!</p>
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
function tplSubastaFinalizadaAdmin({ nombreProducto, ganadorId }) {
    const subject = '📬 Subasta finalizada';
    const ganadorTxt = ganadorId ? ` Ganador ID: ${ganadorId}` : ' Sin ganador.';
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
