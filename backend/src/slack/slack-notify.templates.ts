/**
 * Block Kit templates for builder DM notifications. Ported from the
 * "Beest Crabby" relay, with reviewer impersonation removed — messages are
 * sent from our own bot, and the reviewer name is shown as plain text only
 * when it isn't hidden (`reviewerName === null` → "A reviewer").
 */

export type DmMessage = { text: string; blocks: Record<string, unknown>[] };

interface ReviewDmInput {
  projectName: string;
  /** Link shown on the "View Project" button; omitted when null. */
  projectLink: string | null;
  /** Reviewer's display name, or null when hidden from the owner. */
  reviewerName: string | null;
  feedback: string | null;
}

function reviewerLabel(reviewerName: string | null): string {
  return reviewerName ? `*${reviewerName}*` : 'A reviewer';
}

function viewProjectButton(
  projectLink: string | null,
): Record<string, unknown>[] {
  if (!projectLink) return [];
  return [
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Project' },
          url: projectLink,
        },
      ],
    },
  ];
}

export function reviewApprovedDm(input: ReviewDmInput): DmMessage {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':tada: Your project was approved!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${reviewerLabel(input.reviewerName)} reviewed your project *${input.projectName}* and approved it. Nice work!`,
      },
    },
  ];

  if (input.feedback) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Feedback:* ${input.feedback}` },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Your project will be fraud-checked next, and your Pipes should arrive soon. :yay:',
        },
      ],
    },
    ...viewProjectButton(input.projectLink),
  );

  return { text: `Your project ${input.projectName} was approved`, blocks };
}

export function reviewChangesNeededDm(input: ReviewDmInput): DmMessage {
  const blocks: Record<string, unknown>[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':construction: Changes needed on your project',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${reviewerLabel(input.reviewerName)} reviewed your project *${input.projectName}* and requested some changes.`,
      },
    },
  ];

  if (input.feedback) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Feedback:* ${input.feedback}` },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: "Don't give up — address the feedback and ship again!",
        },
      ],
    },
    ...viewProjectButton(input.projectLink),
  );

  return { text: `Changes needed on ${input.projectName}`, blocks };
}
