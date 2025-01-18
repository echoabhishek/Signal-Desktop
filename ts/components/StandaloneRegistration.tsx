// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Iti } from 'intl-tel-input';
import intlTelInput from 'intl-tel-input';

import { strictAssert } from '../util/assert';
import { parseNumber } from '../util/libphonenumberUtil';
import { missingCaseError } from '../util/missingCaseError';
import { VerificationTransport } from '../types/VerificationTransport';

function PhoneInput({
  initialValue,
  onValidation,
  onNumberChange,
}: {
  initialValue: string | undefined;
  onValidation: (isValid: boolean) => void;
  onNumberChange: (number?: string) => void;
}): JSX.Element {
  const [isValid, setIsValid] = useState(false);
  const pluginRef = useRef<Iti | undefined>();
  const elemRef = useRef<HTMLInputElement | null>(null);

  const onRef = useCallback(
    (elem: HTMLInputElement | null) => {
      elemRef.current = elem;

      if (!elem) {
        return;
      }

      if (initialValue !== undefined) {
        // eslint-disable-next-line no-param-reassign
        elem.value = initialValue;
      }

      pluginRef.current?.destroy();

      const plugin = intlTelInput(elem);
      pluginRef.current = plugin;
    },
    [initialValue]
  );

  const validateNumber = useCallback(
    (number: string) => {
      const { current: plugin } = pluginRef;
      if (!plugin) {
        return;
      }

      const regionCode = plugin.getSelectedCountryData().iso2;

      const parsedNumber = parseNumber(number, regionCode);

      setIsValid(parsedNumber.isValidNumber);
      onValidation(parsedNumber.isValidNumber);

      onNumberChange(
        parsedNumber.isValidNumber ? parsedNumber.e164 : undefined
      );
    },
    [setIsValid, onNumberChange, onValidation]
  );

  const onChange = useCallback(
    (_: ChangeEvent<HTMLInputElement>) => {
      if (elemRef.current) {
        validateNumber(elemRef.current.value);
      }
    },
    [validateNumber]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Pacify TypeScript and handle events bubbling up
      if (event.target instanceof HTMLInputElement) {
        validateNumber(event.target.value);
      }
    },
    [validateNumber]
  );

  return (
    <div className="phone-input">
      <div className="phone-input-form">
        <div className={`number-container ${isValid ? 'valid' : 'invalid'}`}>
          <input
            className="number"
            type="tel"
            ref={onRef}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Phone Number"
          />
        </div>
      </div>
    </div>
  );
}

enum Stage {
  PhoneNumber,
  VerificationCode,
  ProfileName,
}

type StageData =
  | {
      stage: Stage.PhoneNumber;
      initialNumber: string | undefined;
    }
  | {
      stage: Stage.VerificationCode;
      number: string;
      sessionId: string;
    }
  | {
      stage: Stage.ProfileName;
    };

function PhoneNumberStage({
  initialNumber,
  getCaptchaToken,
  requestVerification,
  onNext,
}: {
  initialNumber: string | undefined;
  getCaptchaToken: () => Promise<string>;
  requestVerification: (
    number: string,
    captcha: string,
    transport: VerificationTransport
  ) => Promise<{ sessionId: string }>;
  onNext: (result: { number: string; sessionId: string }) => void;
}): JSX.Element {
  const [number, setNumber] = useState<string | undefined>(initialNumber);

  const [isValidNumber, setIsValidNumber] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const onRequestCode = useCallback(
    async (transport: VerificationTransport) => {
      if (!isValidNumber) {
        return;
      }

      if (!number) {
        setIsValidNumber(false);
        setError(undefined);
        return;
      }

      try {
        const token = await getCaptchaToken();
        const result = await requestVerification(number, token, transport);
        setError(undefined);

        onNext({ number, sessionId: result.sessionId });
      } catch (err) {
        setError(err.message);
      }
    },
    [
      getCaptchaToken,
      isValidNumber,
      setIsValidNumber,
      setError,
      requestVerification,
      number,
      onNext,
    ]
  );

  const onSMSClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      void onRequestCode(VerificationTransport.SMS);
    },
    [onRequestCode]
  );

  const onVoiceClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      void onRequestCode(VerificationTransport.Voice);
    },
    [onRequestCode]
  );

  const theme = window.SignalContext.getThemeSetting();
  const themeClassName = theme === 'dark' ? 'dark-theme' : 'light-theme';

  return (
    <div className={`step-body ${themeClassName}`}>
      <div className="banner-image module-splash-screen__logo module-img--128" />
      <div className="header">Create your Signal Account</div>

      <div>
        <div className="phone-input-form">
          <PhoneInput
            initialValue={initialNumber}
            onValidation={setIsValidNumber}
            onNumberChange={setNumber}
          />
        </div>
      </div>
      <div className="StandaloneRegistration__error">{error}</div>
      <div className="clearfix">
        <button
          type="button"
          className="button"
          disabled={!isValidNumber}
          onClick={onSMSClick}
        >
          Send SMS
        </button>
        <button
          type="button"
          className="link"
          tabIndex={-1}
          disabled={!isValidNumber}
          onClick={onVoiceClick}
        >
          Call
        </button>
      </div>
    </div>
  );
}

export function VerificationCodeStage({
  number,
  sessionId,
  registerSingleDevice,
  onNext,
  onBack,
}: {
  number: string;
  sessionId: string;
  registerSingleDevice: (
    number: string,
    code: string,
    sessionId: string
  ) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}): JSX.Element {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const onCodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setCode(event.target.value);
    },
    [setCode]
  );

  const onVerifyCode = useCallback(async () => {
    if (!code) {
      return;
    }

    try {
      await registerSingleDevice(number, code, sessionId);
      setError(undefined);
      onNext();
    } catch (err) {
      setError(err.message);
    }
  }, [code, number, sessionId, registerSingleDevice, setError, onNext]);

  const theme = window.SignalContext.getThemeSetting();
  const themeClassName = theme === 'dark' ? 'dark-theme' : 'light-theme';

  return (
    <div className={`step-body ${themeClassName}`}>
      <div className="banner-image module-splash-screen__logo module-img--128" />
      <div className="header">Enter your verification code</div>
      <div>
        <input
          type="text"
          className="form-control"
          placeholder="Verification Code"
          value={code}
          onChange={onCodeChange}
          autoComplete="off"
        />
      </div>
      <div className="StandaloneRegistration__error">{error}</div>
      <div className="clearfix">
        <button
          type="button"
          className="button"
          disabled={code.length === 0}
          onClick={onVerifyCode}
        >
          Verify
        </button>
        <button type="button" className="link" tabIndex={-1} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
