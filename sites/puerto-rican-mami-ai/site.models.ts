import { defineModels } from '@shipwords/jobs/models';
import { SITE_MEDIA } from './src/site/media';
import { dancePrompt } from './src/site/scene';

// The create route validates the operator's fixed R2 reference before any job or charge.
export default defineModels([
  {
    id: 'mami-dance', name: 'Puerto Rican Mami dance', kind: 'video', upstream: 'yir',
    upstreamModel: 'klingai/kling-4.0', credits: 10, guest: false,
    allowedParameters: [], maxReferences: 0, maxCost: '4.00', timeoutMinutes: 40,
    effect: {
      slots: [
        { id: 'left', label: 'Left dancer', required: true },
        { id: 'right', label: 'Right dancer', required: false },
      ],
      segments: [{
        id: 'dance', referenceVideo: SITE_MEDIA.reference, slots: ['left', 'right'],
        prompt: (images: Readonly<Record<string, string>>) => dancePrompt({ mode: 'original' }, images),
        parameters: { duration: 15, resolution: '720p', aspect_ratio: 'auto' }, maxCost: '4.00',
      }],
    },
  },
]);
