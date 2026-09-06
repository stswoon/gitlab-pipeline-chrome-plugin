export const STATUS = {
  applyOk: 'Navigation started. You can close the popup.',
  applyNoRepo: 'Could not determine the repository. Open a GitLab project page.',
  readOk: 'Profile updated.',
  readWrongPage: 'Open /-/pipelines/new for this GitLab.',
  readNoScript: 'Refresh the tab and try again.',
  bulkError: 'Invalid query. Fix it or switch back to the previous list.',
  secondBranch: 'A profile can have only one branch row.',
  keepOneProfile: 'Keep at least one profile',
} as const
