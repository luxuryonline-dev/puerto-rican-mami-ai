import { defineModels } from '@shipwords/jobs/models';

// The create route replaces this placeholder with an owned MP4 before any job or charge.
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
        id: 'dance', referenceVideo: 'assets/motion/not-configured.mp4', slots: ['left', 'right'],
        prompt: (images: Readonly<Record<string, string>>) => [
          'Edit @video_1.',
          `Replace the dancer on the left at the start with the adult in ${images.left?.replace(/^@image(\d+)$/, '@image_$1')}.`,
          images.right
            ? `Replace the dancer on the right at the start with the adult in ${images.right.replace(/^@image(\d+)$/, '@image_$1')}.`
            : 'Keep all other people unchanged.',
          'Use each replacement photo for that dancer\'s face, hair, body appearance and outfit. Track each identity continuously even when the dancers swap sides or overlap.',
          'Preserve the choreography, gestures, body rhythm, camera position, framing, environment, lighting and duration of the reference video. Keep the reference audio. Do not add extra people, text, watermarks or camera cuts.',
        ].join(' '),
        parameters: { duration: 15, resolution: '720p', aspect_ratio: 'auto' }, maxCost: '4.00',
      }],
    },
  },
]);
