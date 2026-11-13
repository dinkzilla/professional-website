import type { Reroute } from '@sveltejs/kit/hooks';
import { routeFor } from '#lib/sides.ts';

export const reroute: Reroute = ({ url }) => routeFor(url.pathname);
