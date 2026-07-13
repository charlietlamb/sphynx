"use client";

import { IconPlaceholder } from "@sphynx/ui/components/blocks/preview-02/components/icon-placeholder";
import { Card } from "@sphynx/ui/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@sphynx/ui/components/ui/sidebar";

export function SidebarNav() {
  return (
    <div className="grid grid-cols-2 items-start gap-6">
      <Card className="overflow-hidden py-0">
        <SidebarProvider className="min-h-0">
          <Sidebar className="w-full bg-transparent" collapsible="none">
            <SidebarContent className="gap-0">
              <SidebarGroup className="pb-1">
                <SidebarGroupLabel>Overview</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive>
                        <IconPlaceholder
                          hugeicons="DashboardSquare01Icon"
                          lucide="LayoutDashboardIcon"
                          phosphor="SquaresFourIcon"
                          remixicon="RiDashboardLine"
                          tabler="IconLayoutDashboard"
                        />
                        Dashboard
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="ArrowDataTransferHorizontalIcon"
                          lucide="ArrowLeftRightIcon"
                          phosphor="ArrowsLeftRightIcon"
                          remixicon="RiArrowLeftRightLine"
                          tabler="IconArrowsLeftRight"
                        />
                        Transactions
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="AnalyticsUpIcon"
                          lucide="TrendingUpIcon"
                          phosphor="TrendUpIcon"
                          remixicon="RiLineChartLine"
                          tabler="IconTrendingUp"
                        />
                        Investments
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="BankIcon"
                          lucide="Building2Icon"
                          phosphor="BankIcon"
                          remixicon="RiBankLine"
                          tabler="IconBuildingBank"
                        />
                        Accounts
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="PieChartIcon"
                          lucide="PieChartIcon"
                          phosphor="ChartPieIcon"
                          remixicon="RiPieChartLine"
                          tabler="IconChartPie"
                        />
                        Spending
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator className="w-auto!" />
              <SidebarGroup className="pt-1">
                <SidebarGroupLabel>Planning</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="Target02Icon"
                          lucide="TargetIcon"
                          phosphor="TargetIcon"
                          remixicon="RiFocus3Line"
                          tabler="IconTarget"
                        />
                        Goals
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="Wallet01Icon"
                          lucide="WalletIcon"
                          phosphor="WalletIcon"
                          remixicon="RiWalletLine"
                          tabler="IconWallet"
                        />
                        Budget
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="ChartBarLineIcon"
                          lucide="FileBarChartIcon"
                          phosphor="ChartBarIcon"
                          remixicon="RiBarChartLine"
                          tabler="IconReportAnalytics"
                        />
                        Reports
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="File02Icon"
                          lucide="FileTextIcon"
                          phosphor="FileTextIcon"
                          remixicon="RiFileTextLine"
                          tabler="IconFileText"
                        />
                        Documents
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </Card>
      <Card className="overflow-hidden py-0">
        <SidebarProvider className="min-h-0">
          <Sidebar className="w-full bg-transparent" collapsible="none">
            <SidebarContent className="gap-0">
              <SidebarGroup className="pb-1">
                <SidebarGroupLabel>Account</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="UserIcon"
                          lucide="UserIcon"
                          phosphor="UserIcon"
                          remixicon="RiUserLine"
                          tabler="IconUser"
                        />
                        Profile
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive>
                        <IconPlaceholder
                          hugeicons="CreditCardIcon"
                          lucide="CreditCardIcon"
                          phosphor="CreditCardIcon"
                          remixicon="RiBankCardLine"
                          tabler="IconCreditCard"
                        />
                        Billing
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="Notification03Icon"
                          lucide="BellIcon"
                          phosphor="BellIcon"
                          remixicon="RiBellLine"
                          tabler="IconBell"
                        />
                        Notifications
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="ShieldIcon"
                          lucide="ShieldIcon"
                          phosphor="ShieldIcon"
                          remixicon="RiShieldLine"
                          tabler="IconShield"
                        />
                        Security
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="PaintBoardIcon"
                          lucide="PaintbrushIcon"
                          phosphor="PaletteIcon"
                          remixicon="RiPaletteLine"
                          tabler="IconPalette"
                        />
                        Appearance
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator className="w-auto!" />
              <SidebarGroup className="pt-1">
                <SidebarGroupLabel>Support</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="HelpCircleIcon"
                          lucide="CircleHelpIcon"
                          phosphor="QuestionIcon"
                          remixicon="RiQuestionLine"
                          tabler="IconHelp"
                        />
                        Help Center
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="Message01Icon"
                          lucide="MessageSquareIcon"
                          phosphor="ChatIcon"
                          remixicon="RiChat1Line"
                          tabler="IconMessage"
                        />
                        Contact Us
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="BookOpen02Icon"
                          lucide="BookOpenIcon"
                          phosphor="BookOpenIcon"
                          remixicon="RiBookOpenLine"
                          tabler="IconBook"
                        />
                        Documentation
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <IconPlaceholder
                          hugeicons="ActivityIcon"
                          lucide="ActivityIcon"
                          phosphor="ActivityIcon"
                          remixicon="RiPulseLine"
                          tabler="IconActivity"
                        />
                        Status
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
      </Card>
    </div>
  );
}
