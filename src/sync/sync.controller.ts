import { Controller, Get, Post, Param, Body, Res, Req, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

type RoomMessage = { action: string; time: number };
type RoomState = {
    currentTime: number;
    isPlaying: boolean;
    lastUpdate: number; // timestamp cuando empezó a reproducirse
    interval?: NodeJS.Timeout;
};

const rooms = new Map<string, Response[]>();

const roomStates = new Map<string, RoomState>();

class SseExampleDto {
    message: string;
}
@ApiTags('Sync')

@Controller('sync')
export class SyncController {
    @Get('client/:roomId')
    sse(@Param('roomId') roomId: string, @Res() res: Response, @Req() req: Request) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        // enviar estado actual al cliente que se conecta
        const state = roomStates.get(roomId) || { currentTime: 0, isPlaying: false };
        res.write(`data: ${JSON.stringify({ action: state.isPlaying ? 'play' : 'pause', time: state.currentTime })}\n\n`);

        // guardar cliente para futuros broadcasts
        if (!rooms.has(roomId)) rooms.set(roomId, []);
        const clients = rooms.get(roomId)!;
        clients.push(res);

        // remover cliente al cerrar la conexión
        req.on('close', () => {
            rooms.set(
                roomId,
                rooms.get(roomId)!.filter(c => c !== res)
            );
        });
    }

    // POST: manejar play/pause/stop de la sala
    @ApiOperation({ summary: 'Enviar acción de reproducción/pausa a la sala' })
    @ApiResponse({ status: 200, description: 'Acción enviada correctamente' })
    @Post(':roomId')
    action(@Param('roomId') roomId: string, @Body() body: RoomMessage) {
        const { action, time } = body;
        let state: RoomState = roomStates.get(roomId) || { currentTime: 0, isPlaying: false, lastUpdate: 0 };

        if (action === 'play') {
            state.isPlaying = true;
            if (time !== undefined) state.currentTime = time;
            state.lastUpdate = Date.now();
        }

        if (action === 'pause' || action === 'stop') {
            if (time !== undefined) {
                state.currentTime = time; // usar el valor enviado por el cliente
            } else if (state.isPlaying && state.lastUpdate) {
                state.currentTime += (Date.now() - state.lastUpdate) / 1000;
            }
            state.isPlaying = false;
            state.lastUpdate = 0;
        }

        roomStates.set(roomId, state);

        // Enviar la acción a todos los clientes conectados
        const clients = rooms.get(roomId) || [];
        const message = `data: ${JSON.stringify({ action, time: state.currentTime })}\n\n`;
        clients.forEach(client => client.write(message));

        return { success: true, sentTo: clients.length, currentTime: state.currentTime };
    }

    // GET: resync para clientes que vuelven a reproducir
    @ApiOperation({ summary: 'Obtener currentTime actual de la sala para resync' })
    @ApiResponse({ status: 200, description: 'CurrentTime devuelto correctamente' })
    @Get('resync/:roomId')
    resync(@Param('roomId') roomId: string) {
        const state = roomStates.get(roomId) || { currentTime: 0, isPlaying: false, lastUpdate: 0 };
        let currentTime = state.currentTime;
        if (state.isPlaying && state.lastUpdate) {
            currentTime += (Date.now() - state.lastUpdate) / 1000;
        }
        return { currentTime, isPlaying: state.isPlaying };
    }
}