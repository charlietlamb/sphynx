import { Tabs, TabsList, TabsTrigger } from "@sphynx/ui/components/ui/tabs";
import {
  PULL_REQUEST_TABS,
  type PullRequestTab,
} from "@/components/pull-request/pull-request-search";

interface PullRequestTabsProps {
  conversationCount: number;
  onTabChange: (tab: PullRequestTab) => void;
  tab: PullRequestTab;
}

export function PullRequestTabs({
  conversationCount,
  onTabChange,
  tab,
}: PullRequestTabsProps) {
  return (
    <Tabs
      onValueChange={(value) => {
        const next = PULL_REQUEST_TABS.find((candidate) => candidate === value);
        if (next) {
          onTabChange(next);
        }
      }}
      value={tab}
    >
      <TabsList variant="line">
        <TabsTrigger className="text-[13px]" value="diff">
          Diff
        </TabsTrigger>
        <TabsTrigger className="text-[13px]" value="conversation">
          Conversation
          {conversationCount > 0 ? (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              {conversationCount}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
