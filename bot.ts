import * as dotenv from 'dotenv';
dotenv.config();

import TelegramBot from 'node-telegram-bot-api';
import { ethers } from 'ethers';
import axios from 'axios';

// ============================================
// CONFIGURACIÓN
// ============================================
const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const WALLET_RECEPTORA = process.env.WALLET_RECEPTORA!;
const INTIS_ADDRESS = process.env.INTIS_ADDRESS!;

const PAQUETES: { [key: string]: { nombre: string; usd: number; channelId: string; emoji: string } } = {
    perla: { nombre: 'Luna Perla', usd: 0.99, channelId: process.env.CH_LUNA_PERLA!, emoji: '🤍' },
    cuarzo: { nombre: 'Luna Cuarzo', usd: 1.99, channelId: process.env.CH_LUNA_CUARZO!, emoji: '💎' },
    cristal: { nombre: 'Luna Cristal', usd: 4.99, channelId: process.env.CH_LUNA_CRISTAL!, emoji: '🔮' },
    zafiro: { nombre: 'Luna Zafiro', usd: 9.99, channelId: process.env.CH_LUNA_ZAFIRO!, emoji: '💙' },
    rubi: { nombre: 'Luna Rubí', usd: 19.99, channelId: process.env.CH_LUNA_RUBI!, emoji: '❤️' },
    esmeralda: { nombre: 'Luna Esmeralda', usd: 49.99, channelId: process.env.CH_LUNA_ESMERALDA!, emoji: '💚' },
    diamante: { nombre: 'Luna Diamante', usd: 99.99, channelId: process.env.CH_LUNA_DIAMANTE!, emoji: '💠' },
    platino: { nombre: 'Luna Platino', usd: 199.99, channelId: process.env.CH_LUNA_PLATINO!, emoji: '🤍' }
};

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC!);

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

const intis = new ethers.Contract(INTIS_ADDRESS, ERC20_ABI, provider);

let precioCache: { usd: number; timestamp: number } = { usd: 0, timestamp: 0 };
const CACHE_DURATION = 3 * 60 * 1000;

let ordenCounter = 0;

const ordenesPendientes = new Map<string, {
    userId: number;
    paquete: string;
    intisNecesarios: bigint;
    codigoUnico: number;
    timestamp: number;
}>();

// ============================================
// FUNCIONES
// ============================================
async function obtenerPrecioINTIS(): Promise<number> {
    if (Date.now() - precioCache.timestamp < CACHE_DURATION && precioCache.usd > 0) {
        return precioCache.usd;
    }

    try {
        const response = await axios.get(process.env.DEX_API!);
        const pairs = response.data.pairs;
        
        if (pairs && pairs.length > 0) {
            const pair = pairs.sort((a: any, b: any) => 
                (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            
            const precio = parseFloat(pair.priceUsd);
            precioCache = { usd: precio, timestamp: Date.now() };
            console.log(`💎 Precio INTIS: $${precio}`);
            return precio;
        }
    } catch (err) {
        console.error('❌ Error obteniendo precio:', err);
    }
    
    return precioCache.usd || 0.0001732;
}

// ============================================
// BOT
// ============================================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Bot iniciado: @intis_official_bot');

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from?.first_name || "Usuario";

    const mensaje = `👋 <b>¡Bienvenido a INTIS VIP!</b>

💎 Compra <b>INTIS</b> y accede a descuentos exclusivos y contenido premium.

🦊 <b>Método 1:</b> MetaMask (Polygon Mainnet)

💳 <b>Método 2:</b> Yape

🚀 Todo el proceso es rápido, seguro y automático.

👇 <b>Selecciona una opción:</b>`;

    await bot.sendMessage(chatId, mensaje, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "📦 Ver paquetes", callback_data: "paquetes" }],
                [{ text: "💎 Pagar con INTIS", callback_data: "ayuda_intis" }],
                [{ text: "💳 Pagar con Yape", callback_data: "ayuda_yape" }],
                [{ text: "📈 Precio INTIS", callback_data: "precio" }],
                [{ text: "📖 Guía rápida", callback_data: "ayuda" }]
            ]
        }
    });
});

bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    if (!chatId || !data) return;
    
    await bot.answerCallbackQuery(query.id);
    
    if (data === 'paquetes') {
        const precio = await obtenerPrecioINTIS();
        
        let mensaje = `📦 <b>Paquetes Luna VIP</b>\n\n💎 Precio INTIS: $${precio.toFixed(6)}\n\nSelecciona un paquete:`;
        
        const botones: any[][] = [];
        for (const [key, paq] of Object.entries(PAQUETES)) {
            botones.push([{
                text: `${paq.emoji} ${paq.nombre} - $${paq.usd}`,
                callback_data: `comprar_${key}`
            }]);
        }
        
        botones.push([{ text: '⬅️ Volver', callback_data: 'start' }]);
        
        await bot.sendMessage(chatId, mensaje, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: botones }
        });
        return;
    }
    
    if (data === 'precio') {
        const precio = await obtenerPrecioINTIS();
        const mensaje = `💎 <b>Precio actual de INTIS</b>\n\n$${precio.toFixed(6)} USD\n\n<i>Precio actualizado en tiempo real desde DexScreener</i>`;
        
        await bot.sendMessage(chatId, mensaje, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'start' }]] }
        });
        return;
    }
    
if (data === "ayuda") {

    const mensaje = `📖 <b>¿Cómo comprar?</b>

1️⃣ Compra <b>INTIS</b> usando <b>MetaMask</b> en la red <b>Polygon Mainnet</b>.

2️⃣ Pulsa <b>📦 Ver paquetes</b> y elige el que deseas.

3️⃣ El bot mostrará la cantidad exacta de INTIS o el monto por Yape.

4️⃣ Realiza el pago.

5️⃣ Pulsa <b>✅ Verificar pago</b>.

🎉 Si todo es correcto recibirás automáticamente tu acceso VIP.

━━━━━━━━━━━━━━━

💎 <b>Comprar INTIS</b>

https://quickswap.exchange/#/swap?outputCurrency=${INTIS_ADDRESS}`;

    await bot.sendMessage(chatId, mensaje, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{ text: "⬅️ Volver", callback_data: "start" }]
            ]
        }
    });

    return;
}
    if (data === "ayuda_intis") {

    const mensaje = `💎 <b>Pagar con INTIS</b>

🦊 Usa una wallet compatible como <b>MetaMask</b>.

1️⃣ Cambia a la red <b>Polygon Mainnet</b>.

2️⃣ Compra INTIS.

3️⃣ Pulsa <b>📦 Ver paquetes</b>.

4️⃣ Elige el paquete que deseas.

5️⃣ Envía la cantidad exacta de INTIS.

6️⃣ Pulsa <b>✅ Verificar pago</b>.

🎉 El acceso VIP se entregará automáticamente cuando la blockchain confirme el pago.`;

    await bot.sendMessage(chatId, mensaje, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "📦 Ver paquetes", callback_data: "paquetes" }],
                [{ text: "⬅️ Volver", callback_data: "start" }]
            ]
        }
    });

    return;
}

if (data === "ayuda_yape") {

    const mensaje = `💳 <b>Pagar con Yape</b>

🇵🇪 También puedes comprar con Yape.

1️⃣ Pulsa <b>📦 Ver paquetes</b>.

2️⃣ Elige el paquete.

3️⃣ Escanea el código QR.

4️⃣ Envía el comprobante.

⏳ Un administrador revisará el pago y activará tu acceso VIP.`;

await bot.sendPhoto(
    chatId,
    "./assets/yape_qr.jpeg",
    {
        caption: mensaje,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "📦 Ver paquetes", callback_data: "paquetes" }],
                [{ text: "⬅️ Volver", callback_data: "start" }]
            ]
        }
    }
);

    return;
}
if (data === "start") {

    const userName = query.from.first_name || "Usuario";

    const mensaje = `👋 <b>¡Bienvenido nuevamente ${userName}!</b>

💎 Compra <b>INTIS</b> y obtén acceso a descuentos exclusivos.

🦊 <b>Método 1:</b> MetaMask (Polygon)

💳 <b>Método 2:</b> Yape

👇 Elige una opción:`;

    await bot.sendMessage(chatId, mensaje, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "📦 Ver paquetes", callback_data: "paquetes" }],
                [{ text: "💎 Pagar con INTIS", callback_data: "ayuda_intis" }],
                [{ text: "💳 Pagar con Yape", callback_data: "ayuda_yape" }],
                [{ text: "📈 Precio INTIS", callback_data: "precio" }],
                [{ text: "📖 Guía rápida", callback_data: "ayuda" }]
            ]
        }
    });

    return;
}
    
    if (data.startsWith('comprar_')) {
        const paqueteKey = data.replace('comprar_', '');
        const paquete = PAQUETES[paqueteKey];
        
        if (!paquete) {
            await bot.sendMessage(chatId, '❌ Paquete no encontrado.');
            return;
        }
        
        const precio = await obtenerPrecioINTIS();
        const intisBase = Math.ceil(paquete.usd / precio);  // Redondeamos hacia arriba
        
        // Generar código único
        ordenCounter++;
        const codigoUnico = ordenCounter;
        
        // Cantidad con código único en decimales: base.XXXX
        const intisFinales = intisBase + (codigoUnico / 10000);
        
        const orderId = `${userId}_${Date.now()}`;
        ordenesPendientes.set(orderId, {
            userId,
            paquete: paqueteKey,
            intisNecesarios: ethers.parseEther(intisFinales.toFixed(4)),
            codigoUnico,
            timestamp: Date.now()
        });
        
        const mensaje = `${paquete.emoji} <b>${paquete.nombre}</b> - $${paquete.usd} USD\n\n💎 <b>Cantidad EXACTA a enviar:</b>\n<code>${intisFinales.toFixed(4)} INTIS</code>\n\n⚠️ <b>IMPORTANTE:</b> Debes enviar la cantidad EXACTA con TODOS los decimales. Es tu código único de pago.\n\n📤 <b>Wallet receptora:</b>\n<code>${WALLET_RECEPTORA}</code>\n\n🌐 <b>Red:</b> Polygon Mainnet\n💎 <b>Token:</b> INTIS\n🔢 <b>Tu código:</b> ${codigoUnico}\n\n⏰ <b>Tienes 15 minutos para pagar</b>\n\n<i>Una vez enviado, click en "Verificar Pago"</i>`;
        
        await bot.sendMessage(chatId, mensaje, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Verificar Pago', callback_data: `verificar_${orderId}` }],
                    [{ text: '❌ Cancelar', callback_data: 'paquetes' }]
                ]
            }
        });
        return;
    }
    
    if (data.startsWith('verificar_')) {
        const orderId = data.replace('verificar_', '');
        const orden = ordenesPendientes.get(orderId);
        
        if (!orden) {
            await bot.sendMessage(chatId, '❌ Orden no encontrada o expirada.');
            return;
        }
        
        if (orden.userId !== userId) {
            await bot.sendMessage(chatId, '❌ Esta orden no es tuya.');
            return;
        }
        
        if (Date.now() - orden.timestamp > 15 * 60 * 1000) {
            ordenesPendientes.delete(orderId);
            await bot.sendMessage(chatId, '⏰ Orden expirada.');
            return;
        }
        
        await bot.sendMessage(chatId, '🔍 Verificando pago en la blockchain...');
        
        try {
            const filter = intis.filters.Transfer(null, WALLET_RECEPTORA);
            const fromBlock = await provider.getBlockNumber() - 200;
            const events = await intis.queryFilter(filter, fromBlock);
            
            // Buscar EXACTAMENTE la cantidad con los decimales únicos
            for (const event of events) {
                const args = (event as any).args;
                const amount = args[2] as bigint;
                
                // Comparación EXACTA (no por tolerancia)
                if (amount === orden.intisNecesarios) {
                    const paquete = PAQUETES[orden.paquete];
                    
                    try {
                        const inviteLink = await bot.createChatInviteLink(paquete.channelId, {
                            member_limit: 1,
                            name: `User_${userId}_${orden.codigoUnico}`
                        });
                        
                        await bot.sendMessage(chatId, `✅ <b>¡Pago confirmado!</b>\n\n${paquete.emoji} Bienvenid@ a <b>${paquete.nombre}</b>\n\n🔢 Código verificado: ${orden.codigoUnico}\n\n🔗 Tu link de acceso (un solo uso):\n${inviteLink.invite_link}\n\n<i>Este link solo puedes usarlo tú. No lo compartas.</i>`, {
                            parse_mode: 'HTML'
                        });
                        
                        ordenesPendientes.delete(orderId);
                        console.log(`✅ Acceso otorgado: Usuario ${userId} → ${paquete.nombre} (código ${orden.codigoUnico})`);
                        return;
                    } catch (err: any) {
                        console.error('Error creando link:', err);
                        await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
                        return;
                    }
                }
            }
            
            await bot.sendMessage(chatId, `❌ <b>No se detectó el pago todavía</b>\n\nVerifica:\n1. Wallet correcta: <code>${WALLET_RECEPTORA}</code>\n2. Cantidad EXACTA con decimales: ${ethers.formatEther(orden.intisNecesarios)} INTIS\n3. Transacción confirmada\n\nEspera 1-2 minutos y vuelve a verificar.`, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: '🔄 Verificar de nuevo', callback_data: `verificar_${orderId}` }]]
                }
            });
        } catch (err: any) {
            console.error('Error:', err);
            await bot.sendMessage(chatId, `❌ Error verificando: ${err.message}`);
        }
        return;
    }
});

// Comando /publicar - Solo admin
bot.onText(/\/publicar/, async (msg) => {
    const userId = msg.from?.id;
    
    if (userId !== ADMIN_ID) {
        await bot.sendMessage(msg.chat.id, '❌ Solo el admin puede usar este comando.');
        return;
    }
    
    const CANAL_PUBLICO = '@lunamcxvip';
    
    const mensaje = `🌙 <b>LUNA MCX VIP</b> 🌙\n━━━━━━━━━━━━━━━\n\n✨ Accede a contenido <b>EXCLUSIVO</b>\n💎 8 niveles disponibles\n🔒 Pago con INTIS\n🚀 Acceso inmediato\n\n<i>Click en el botón y empieza ahora</i>`;
    
    try {
        await bot.sendMessage(CANAL_PUBLICO, mensaje, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 ABRIR LUNA VIP', url: 'https://t.me/intis_official_bot' }]
                ]
            }
        });
        
        await bot.sendMessage(msg.chat.id, '✅ Mensaje publicado en @lunamcxvip\n\n💡 No olvides FIJARLO manualmente desde el canal.');
    } catch (err: any) {
        await bot.sendMessage(msg.chat.id, `❌ Error: ${err.message}\n\nVerifica que el bot sea admin de @lunamcxvip con permiso de publicar.`);
    }
});

process.on('unhandledRejection', (reason: any) => {
    console.error('⚠️ Promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err: any) => {
    console.error('⚠️ Excepción:', err?.message || err);
});

console.log('✅ Bot listo para recibir mensajes');