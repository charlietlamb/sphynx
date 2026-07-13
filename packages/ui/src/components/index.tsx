"use client";

import { AccountAccess } from "@sphynx/ui/components/blocks/preview-02/cards/account-access";
import { CardOverview } from "@sphynx/ui/components/blocks/preview-02/cards/card-overview";
import { ClaimableBalance } from "@sphynx/ui/components/blocks/preview-02/cards/claimable-balance";
import { ContributionHistory } from "@sphynx/ui/components/blocks/preview-02/cards/contribution-history";
import { CoverArt } from "@sphynx/ui/components/blocks/preview-02/cards/cover-art";
import { DividendIncome } from "@sphynx/ui/components/blocks/preview-02/cards/dividend-income";
import { EmptyConnectBank } from "@sphynx/ui/components/blocks/preview-02/cards/empty-connect-bank";
import { EmptyDistributeTrack } from "@sphynx/ui/components/blocks/preview-02/cards/empty-distribute-track";
import { EmptyExploreCatalog } from "@sphynx/ui/components/blocks/preview-02/cards/empty-explore-catalog";
import { Faq } from "@sphynx/ui/components/blocks/preview-02/cards/faq";
import { FrontDoor } from "@sphynx/ui/components/blocks/preview-02/cards/front-door";
import { IndexInvesting } from "@sphynx/ui/components/blocks/preview-02/cards/index-investing";
import { KitchenIsland } from "@sphynx/ui/components/blocks/preview-02/cards/kitchen-island";
import { LoadingCard } from "@sphynx/ui/components/blocks/preview-02/cards/loading-card";
import { NewMilestone } from "@sphynx/ui/components/blocks/preview-02/cards/new-milestone";
import { NotificationSettings } from "@sphynx/ui/components/blocks/preview-02/cards/notification-settings";
import { Payments } from "@sphynx/ui/components/blocks/preview-02/cards/payments";
import { PayoutThreshold } from "@sphynx/ui/components/blocks/preview-02/cards/payout-threshold";
import { PowerUsage } from "@sphynx/ui/components/blocks/preview-02/cards/power-usage";
import { Preferences } from "@sphynx/ui/components/blocks/preview-02/cards/preferences";
import { ReceivingMethod } from "@sphynx/ui/components/blocks/preview-02/cards/receiving-method";
import { RecentTransactions } from "@sphynx/ui/components/blocks/preview-02/cards/recent-transactions";
import { ReleaseCatalog } from "@sphynx/ui/components/blocks/preview-02/cards/release-catalog";
import { RollerShades } from "@sphynx/ui/components/blocks/preview-02/cards/roller-shades";
import { SavingsProgress } from "@sphynx/ui/components/blocks/preview-02/cards/savings-progress";
import { SavingsTargets } from "@sphynx/ui/components/blocks/preview-02/cards/savings-targets";
import { SidebarNav } from "@sphynx/ui/components/blocks/preview-02/cards/sidebar-nav";
import { SocialLinks } from "@sphynx/ui/components/blocks/preview-02/cards/social-links";
import { StockPerformance } from "@sphynx/ui/components/blocks/preview-02/cards/stock-performance";
import { SyncingState } from "@sphynx/ui/components/blocks/preview-02/cards/syncing-state";
import { TransferFunds } from "@sphynx/ui/components/blocks/preview-02/cards/transfer-funds";
import { UpcomingPayments } from "@sphynx/ui/components/blocks/preview-02/cards/upcoming-payments";

export default function Preview02Example() {
  return (
    <div className="contain-[paint] overflow-x-auto overflow-y-hidden bg-muted 3xl:[--gap:--spacing(12)] [--gap:--spacing(4)] dark:bg-background md:[--gap:--spacing(10)] style-lyra:md:[--gap:--spacing(6)] style-mira:md:[--gap:--spacing(6)]">
      <div className="flex w-full min-w-max justify-center">
        <div
          className="grid w-[2400px] grid-cols-7 items-start gap-(--gap) bg-muted p-(--gap) md:w-[3000px] style-lyra:md:w-[2600px] style-mira:md:w-[2600px] dark:bg-background *:[div]:gap-(--gap)"
          data-slot="capture-target"
        >
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <ContributionHistory />
            <EmptyDistributeTrack />
            <DividendIncome />
            <IndexInvesting />
            <SyncingState />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <PayoutThreshold />
            <ClaimableBalance />
            <Preferences />
            <SavingsProgress />
            <KitchenIsland />
          </div>
          <div className="col-span-2 flex flex-col p-1 [contain-intrinsic-size:760px_1200px] [content-visibility:auto]">
            <SavingsTargets />
            <RecentTransactions />
            <div className="grid grid-cols-2 items-start gap-(--gap)">
              <div className="flex flex-col gap-(--gap)">
                <SidebarNav />
                <Faq />
              </div>
              <div className="flex flex-col gap-(--gap)">
                <Payments />
                <FrontDoor />
              </div>
            </div>
            <ReleaseCatalog />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <AccountAccess />
            <CardOverview />
            <TransferFunds />
            <CoverArt />
            <LoadingCard />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <ReceivingMethod />
            <PowerUsage />
            <EmptyConnectBank />
            <UpcomingPayments />
            <RollerShades />
          </div>
          <div className="flex flex-col p-1 [contain-intrinsic-size:380px_1200px] [content-visibility:auto]">
            <StockPerformance />
            <EmptyExploreCatalog />
            <NewMilestone />
            <SocialLinks />
            <NotificationSettings />
          </div>
        </div>
      </div>
    </div>
  );
}
