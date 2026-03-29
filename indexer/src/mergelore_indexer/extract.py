"""Extract merged PR content from GitHub API."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from github import Github


@dataclass
class PRDocument:
    number: int
    title: str
    body: str
    url: str
    merged_at: str
    author: str
    files: list[str]
    review_comments: list[str] = field(default_factory=list)
    linked_issues: list[str] = field(default_factory=list)

    def to_text(self) -> str:
        """Concatenate all PR content into a single string for embedding."""
        parts = [
            f"PR #{self.number}: {self.title}",
            self.body or "",
        ]
        if self.files:
            parts.append(f"Files changed: {', '.join(self.files)}")
        for comment in self.review_comments:
            parts.append(f"Review comment: {comment}")
        for issue in self.linked_issues:
            parts.append(f"Linked issue: {issue}")
        return "\n\n".join(parts)


def find_merged_pr_from_push(
    event_path: str | None,
    github_client: Github,
    owner: str,
    repo: str,
) -> int | None:
    """Find the merged PR number from a push event."""
    if not event_path:
        return None

    with open(event_path) as f:
        event = json.load(f)

    head_sha = event.get("after") or event.get("head_commit", {}).get("id")
    if not head_sha:
        return None

    gh_repo = github_client.get_repo(f"{owner}/{repo}")
    commit = gh_repo.get_commit(head_sha)
    pulls = commit.get_pulls()

    for pr in pulls:
        if pr.merged:
            return pr.number

    return None


def extract_pr(
    github_client: Github,
    owner: str,
    repo: str,
    pr_number: int,
) -> PRDocument:
    """Extract full PR content for indexing."""
    gh_repo = github_client.get_repo(f"{owner}/{repo}")
    pr = gh_repo.get_pull(pr_number)

    # Files touched
    files = [f.filename for f in pr.get_files()]

    # Review comments (both review-level and inline)
    review_comments: list[str] = []
    for review in pr.get_reviews():
        if review.body:
            review_comments.append(review.body)
    for comment in pr.get_review_comments():
        if comment.body:
            review_comments.append(comment.body)

    # Linked issues (parse from body)
    linked_issues: list[str] = []
    if pr.body:
        issue_refs = re.findall(r"(?:fixes|closes|resolves)\s+#(\d+)", pr.body, re.IGNORECASE)
        for ref in issue_refs:
            try:
                issue = gh_repo.get_issue(int(ref))
                linked_issues.append(f"#{ref}: {issue.title}")
            except Exception:
                linked_issues.append(f"#{ref}")

    return PRDocument(
        number=pr.number,
        title=pr.title,
        body=pr.body or "",
        url=pr.html_url,
        merged_at=pr.merged_at.isoformat() if pr.merged_at else "",
        author=pr.user.login if pr.user else "unknown",
        files=files,
        review_comments=review_comments,
        linked_issues=linked_issues,
    )
