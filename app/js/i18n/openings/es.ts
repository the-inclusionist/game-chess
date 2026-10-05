// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/openings/es — por qué alguien juega cada apertura, en español.
//
// Escrito aquí, no traducido del portugués: una frase en español que suena a portugués traducido es
// peor que cualquiera de las dos. Se mantiene la estructura a propósito — qué HACE la apertura, por
// qué alguien lo haría y qué cuesta — porque toda apertura cuesta algo, y esconderlo enseñaría que
// hay jugadas gratis.
//
// ⚠️ Las jugadas van en la notación que imprime la lista del panel, que es la inglesa (`Nf3`,
// `Bb5`). En español se escribiría `Cf3`, y sería correcto, pero la criatura no encontraría esa
// jugada en la pantalla. El razonamiento está en `i18n/openings/index.ts`.

import type { OpeningStrings } from './index.ts';

export const es: OpeningStrings = {
  /* ---------------- 1.e4 e5 ---------------- */
  'opening.kingpawn':
    'El peón del rey abre camino al obispo y a la reina de una sola vez, y por eso 1.e4 es la '
    + 'primera jugada más jugada de la historia. Quien abre así quiere sus piezas afuera pronto.',
  'opening.italian':
    'El obispo va a c4 y mira directamente a f7, la casilla más débil del comienzo. Es la apertura '
    + 'más antigua que todavía se juega en torneo y la mejor para aprender: todo lo que pasa en ella '
    + 'se ve. A cambio, el rival también la conoce.',
  'opening.ruylopez':
    'El obispo va a b5 y ataca al caballo que defiende el peón de e5. No se trata de ganar ese peón '
    + 'ahora, sino de molestar a su defensor durante toda la partida. La llaman la apertura '
    + 'española, y es la preferida de los campeones desde hace cuatrocientos años.',
  'opening.fourknights':
    'Los cuatro caballos salen antes que nada. Es simétrica, sólida y casi sin trampas, así que '
    + 'quien aprende puede seguir cada jugada. Estas partidas se deciden más tarde, en el medio '
    + 'juego, no en la apertura.',
  'opening.scotch':
    'Las blancas abren el centro en la tercera jugada con d4 y cambian el peón enseguida. El '
    + 'tablero se abre y las piezas ganan sitio, pero la reina suele salir temprano, y lo que sale '
    + 'temprano acaba perseguido.',
  'opening.vienna':
    'El caballo va primero a c3 y guarda el avance f4 para después. Es una manera tranquila de '
    + 'preparar un ataque violento, y justo por eso engaña: parece lenta y no lo es.',
  'opening.bishops':
    'El obispo apunta a f7 en la segunda jugada, antes de mover ningún caballo. Es directa y deja a '
    + 'las blancas muchísimas opciones. El precio es un centro sin apoyo durante algunas jugadas.',
  'opening.center':
    'Las blancas abren el centro de inmediato y aceptan sacar la reina para recapturar. Se gana '
    + 'tiempo y espacio; se pierde la calma, porque una reina expuesta es para lo que existen los '
    + 'caballos.',
  'opening.kgaccepted':
    'Las blancas ofrecieron el peón de f2 y las negras lo tomaron. Ahora las blancas tienen el '
    + 'centro y una columna abierta para la torre, y las negras un peón de más y un rey con menos '
    + 'techo. Es la apertura más romántica del siglo diecinueve y la más peligrosa para los dos.',
  'opening.kgdeclined':
    'Las negras rechazaron el peón y prefirieron sostener el centro. Es la respuesta adulta: el '
    + 'regalo que no se acepta no hay que devolverlo. La partida se vuelve menos salvaje y mucho '
    + 'más larga.',
  'opening.petrov':
    'Las negras responden atacando en vez de defender: el caballo va a f6 y le cobra al peón de e4. '
    + 'Cambiar en el centro simplifica todo, lo que es magnífico cuando vas mal de reloj y aburrido '
    + 'cuando querías una partida complicada.',
  'opening.philidor':
    'Las negras sostienen el peón de e5 con d6, con un peón. Es sólido, y fue la recomendación de '
    + 'Philidor, el primer gran teórico del juego. El defecto es el espacio: el obispo de f8 se '
    + 'queda detrás de su propio peón un buen rato.',

  /* ---------------- 1.e4, respondido de otra manera ---------------- */
  'opening.sicilian':
    'Las negras no responden en el centro: juegan c5, de lado, y ya ofrecen cambiar un peón de ala '
    + 'por uno del centro. Es la defensa más jugada del mundo porque no busca tablas, busca '
    + 'desequilibrio. A cambio, el rey negro tarda más en estar a salvo.',
  'opening.french':
    'Las negras preparan d5 con e6 y aceptan que el obispo de c8 quede encerrado por ahora. El '
    + 'cambio es claro: menos espacio hoy, una estructura durísima de romper mañana. A quien le '
    + 'gusta defender, le encanta.',
  'opening.carokann':
    'La misma idea de la francesa — llegar a d5 — pero preparada con c6, de modo que el obispo de '
    + 'c8 sigue libre. Es para quien quiere solidez sin pagarla con piezas encerradas. El precio es '
    + 'tiempo: c6 no desarrolla nada.',
  'opening.scandinavian':
    'Las negras juegan d5 en la primera jugada y cambian en el centro de inmediato. Es fácil de '
    + 'aprender y casi no hay nada que memorizar. Pero la reina negra sale muy pronto, y las blancas '
    + 'ganan jugadas persiguiéndola.',
  'opening.alekhine':
    'El caballo va a f6 enseguida e invita a los peones blancos a perseguirlo. El plan es dejar que '
    + 'las blancas avancen demasiado y luego atacar ese muro de peones por debajo. Es una apuesta: '
    + 'si el muro aguanta, las negras se quedan sin sitio.',
  'opening.pirc':
    'Las negras entregan el centro a propósito y construyen una casa para el rey con g6 y el obispo '
    + 'en g7. Ese obispo vigila todo el tablero por la diagonal larga. El riesgo se conoce: si el '
    + 'contraataque no llega, solo queda el ahogo.',
  'opening.modern':
    'La idea de la Pirc sin comprometerse: primero g6, y el caballo decide después dónde va. Da a '
    + 'las negras la máxima flexibilidad y a las blancas la mayor libertad en el centro.',

  /* ---------------- 1.d4 ---------------- */
  'opening.queenpawn':
    'El peón de la reina avanza ya defendido por la propia reina, y en eso está toda la diferencia '
    + 'entre 1.d4 y 1.e4. Las partidas tienden a ser más cerradas y a decidirse por planes, no por '
    + 'tácticas inmediatas.',
  'opening.qgd':
    'Las blancas ofrecen el peón de c4 y las negras lo rechazan, sosteniendo d5 con e6. Es la '
    + 'apertura de los campeonatos del mundo: poca suerte y mucho plan. El obispo de c8 paga la '
    + 'cuenta, igual que en la francesa.',
  'opening.qga':
    'Las negras toman el peón de c4 sabiendo que no se lo van a quedar. La ganancia es otra: '
    + 'cambian un peón del centro por libertad para las piezas. Jugar así es aceptar menos centro a '
    + 'cambio de no estar nunca apretado.',
  'opening.slav':
    'Las negras sostienen d5 con c6 en vez de e6, y así el obispo de c8 todavía puede salir a f5 o '
    + 'g4. Es la manera sólida de enfrentar el gambito de dama sin encerrar nada. El precio es que '
    + 'el peón de c6 ocupa la casilla de su propio caballo.',
  'opening.semislav':
    'Las negras juegan c6 Y e6, y se llevan lo mejor de ambos mundos y también lo peor: la '
    + 'estructura queda firmísima y el obispo de c8 completamente encerrado. De aquí salen algunas '
    + 'de las posiciones más difíciles y más estudiadas del ajedrez.',
  'opening.nimzo':
    'El obispo va a b4 y clava al caballo de c3, el caballo que las blancas necesitan para empujar '
    + 'e4. Es la defensa más respetada contra 1.d4, y pelea por el centro con piezas en vez de con '
    + 'peones. Las negras suelen entregar ese obispo por el caballo, y eso es parte del plan.',
  'opening.kingsindian':
    'Las negras dejan que las blancas tomen el centro, esconden al rey detrás de g6 con el obispo '
    + 'en g7, y solo entonces golpean con e5 o c5. Es contraataque puro, y es la preferida de quien '
    + 'juega a ganar. También castiga a quien no conoce el plan.',
  'opening.queensindian':
    'Las negras ponen el obispo en b7 y vigilan el centro por la diagonal larga, desde lejos. Es '
    + 'sólida, flexible y casi imposible de atacar pronto. También hace tablas con facilidad.',
  'opening.grunfeld':
    'Las negras responden en el centro con d5 e invitan a las blancas a tomarlo todo con peones. La '
    + 'idea es que un muro blanco enorme es también un blanco enorme, y le van a disparar desde los '
    + 'lados. Hace falta valor y precisión.',
  'opening.benoni':
    'Las negras enfrentan d4 con c5, de lado, y aceptan menos espacio a cambio de una columna '
    + 'abierta y de un avance con e5 o b5 más adelante. Es afilada: partidas decisivas y pocas '
    + 'tablas.',
  'opening.dutch':
    'Las negras juegan f5 y apuntan al rey blanco desde la primera jugada. Es agresiva y poco '
    + 'común. El precio es inmediato y permanente: la casilla e6 y la diagonal de su propio rey '
    + 'quedan más débiles para siempre.',

  /* ---------------- sin peón central en la primera jugada ---------------- */
  'opening.english':
    'Las blancas empiezan por el flanco con c4 y pelean por el centro desde lejos. Puede '
    + 'convertirse después en casi cualquier otra apertura, y por eso tantos campeones la usan: '
    + 'esconde el plan.',
  'opening.reti':
    'El caballo sale antes que cualquier peón central, y las blancas resuelven el centro solo '
    + 'después de ver qué hacen las negras. Es la idea que cambió el ajedrez en los años veinte: '
    + 'ocupar el centro con piezas en vez de peones.',
};
