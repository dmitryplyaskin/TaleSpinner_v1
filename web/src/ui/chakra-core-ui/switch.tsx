import { Switch as ChakraSwitch } from '@chakra-ui/react';
import * as React from 'react';

import { InfoTip } from './toggle-tip';

export interface SwitchProps extends ChakraSwitch.RootProps {
	inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
	rootRef?: React.Ref<HTMLLabelElement>;
	trackLabel?: { on: React.ReactNode; off: React.ReactNode };
	thumbLabel?: { on: React.ReactNode; off: React.ReactNode };
	infoTip?: React.ReactNode;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(props, ref) {
	const { inputProps, children, rootRef, trackLabel, thumbLabel, infoTip, ...rest } = props;

	return (
		<ChakraSwitch.Root ref={rootRef} {...rest}>
			<ChakraSwitch.HiddenInput ref={ref} {...inputProps} />
			<ChakraSwitch.Control>
				<ChakraSwitch.Thumb>
					{thumbLabel && (
						<ChakraSwitch.ThumbIndicator fallback={thumbLabel?.off}>{thumbLabel?.on}</ChakraSwitch.ThumbIndicator>
					)}
				</ChakraSwitch.Thumb>
				{trackLabel && <ChakraSwitch.Indicator fallback={trackLabel.off}>{trackLabel.on}</ChakraSwitch.Indicator>}
			</ChakraSwitch.Control>
			{children !== null && children !== undefined && (
				<ChakraSwitch.Label display="flex" alignItems="center" gap={2}>
					{children}
					{infoTip && <InfoTip content={infoTip} size="lg" />}
				</ChakraSwitch.Label>
			)}
		</ChakraSwitch.Root>
	);
});
