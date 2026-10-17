import { createFileRoute } from "@tanstack/react-router";
import { fetchAllVehiclePositions, fetchAllArrivals } from "@/lib/gtfsrt/fetch-arrivals";
import { parseOccupancy } from "@/lib/occupancy";

export const Route = createFileRoute("/api/buses/$vehicleId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const id = String(params.vehicleId);
          const [vehicles, arrivals] = await Promise.all([
            fetchAllVehiclePositions(),
            fetchAllArrivals(),
          ]);
          const v = vehicles.find((x) => x.vehicleId === id);
          if (!v) {
            return Response.json(
              { error: "Bus no encontrado o sin señal en este momento", vehicleId: id },
              { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
            );
          }
          const now = Math.floor(Date.now() / 1000);
          const stops = arrivals
            .filter((a) => a.vehicleId === id)
            .sort((a, b) => a.estimatedArrival - b.estimatedArrival)
            .map((a) => ({
              stopId: a.stopId,
              stopName: a.stopName,
              tripId: a.tripId,
              routeId: a.routeId,
              routeShortName: a.routeShortName,
              routeName: a.routeName,
              routeColor: a.routeColor,
              directionId: a.directionId ?? null,
              estimatedArrival: a.estimatedArrival,
              minutesAway: Math.max(0, Math.round((a.estimatedArrival - now) / 60)),
            }));
          return Response.json(
            {
              vehicleId: v.vehicleId,
              label: v.vehicleName ?? v.vehicleId,
              routeId: v.routeId || null,
              position: { lat: v.lat, lon: v.lon, speed: v.speed ?? null, bearing: v.bearing ?? null },
              timestamp: v.timestamp ?? null,
              occupancy: parseOccupancy(v.occupancyStatus, v.occupancyPercentage),
              nextStops: stops,
              updatedAt: now,
            },
            {
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=5",
              },
            },
          );
        } catch (e) {
          return new Response(`Error: ${(e as Error).message}`, { status: 502 });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});