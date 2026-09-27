import React, { useState } from 'react';
import { View } from 'react-native';
import { ChartNoAxesCombinedIcon, FileTextIcon, LayersIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  Button,
  Card,
  ListRow,
  Notice,
  OfflineBanner,
  RadioRow,
  Screen,
  SectionHeader,
  StepDots,
  StickyFooter,
} from '@shared/components';
import { colors } from '@shared/theme';
import { ANALYSIS_TYPES, ANALYSIS_TYPE_DESCRIPTIONS, ANALYSIS_TYPE_LABELS, type AnalysisType } from '../models/types';
import { ANALYSIS_TYPE_ICONS } from '../components/ResultSections';
import { useParkManagerNavigation } from '../navigation/types';

/** UC-03 steps 1–2: Data Analysis & Reporting options and analysis type selection. */
export function AnalysisOptionsScreen() {
  const navigation = useParkManagerNavigation();
  const [type, setType] = useState<AnalysisType>('INCIDENT');

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Data Analysis & Reporting" subtitle="Step 1 of 3 · Choose an analysis" hideBack right={<BellButton />} />
      <OfflineBanner />
      <Screen>
        <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
            <ChartNoAxesCombinedIcon size={19} color={colors.forest500} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <AppText size={13} color={colors.muted} lineHeight={18}>
              Analyse operations data for one or more parks, review charts and hotspots, then generate a PDF conservation report.
            </AppText>
            <StepDots step={0} total={3} />
          </View>
        </Card>

        <SectionHeader title="Analysis type" style={{ marginTop: 20 }} />
        <View style={{ gap: 10 }}>
          {ANALYSIS_TYPES.map((t) => (
            <RadioRow
              key={t}
              icon={ANALYSIS_TYPE_ICONS[t]}
              label={ANALYSIS_TYPE_LABELS[t]}
              description={ANALYSIS_TYPE_DESCRIPTIONS[t]}
              selected={type === t}
              onSelect={() => setType(t)}
            />
          ))}
        </View>

        <Notice
          tone="info"
          icon={LayersIcon}
          style={{ marginTop: 16 }}
          title="Multiple parks"
          message="Select two or more parks on the next step to run a combined analysis with a per-park comparison."
        />

        <Card style={{ marginTop: 20 }}>
          <ListRow
            icon={FileTextIcon}
            title="Reports library"
            subtitle="Previously generated conservation reports"
            onPress={() => navigation.navigate('Tabs', { screen: 'Reports' })}
          />
        </Card>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={() => navigation.navigate('AnalysisFilters', { type })}>
          Continue
        </Button>
      </StickyFooter>
    </View>
  );
}
