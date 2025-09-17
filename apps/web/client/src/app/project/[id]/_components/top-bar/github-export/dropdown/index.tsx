'use client';

import { useEditorEngine } from '@/components/store/editor';
import { api } from '@/trpc/react';
import { Button } from '@onlook/ui/button';
import { Icons } from '@onlook/ui/icons';
import { Separator } from '@onlook/ui/separator';
import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';
import { CreateRepositoryStep } from './create-repository';
import { InstallationStep } from './installation';
import { RepositoryConnectedStep } from './repository-connected';
import { SelectOwnerStep } from './select-owner';

export enum ExportStep {
    INSTALLATION = 'installation',
    SELECT_OWNER = 'select_owner', 
    CREATE_REPOSITORY = 'create_repository',
    REPOSITORY_CONNECTED = 'repository_connected',
}

interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    private: boolean;
    default_branch: string;
    clone_url: string;
    owner: {
        login: string;
        avatar_url: string;
    };
}

export const GitHubExportDropdown = observer(() => {
    const editorEngine = useEditorEngine();
    const [currentStep, setCurrentStep] = useState<ExportStep>(ExportStep.INSTALLATION);
    const [selectedOwner, setSelectedOwner] = useState<string>('');
    const [repositoryData, setRepositoryData] = useState<GitHubRepository | null>(null);

    // Check if GitHub App is installed
    const { data: installationId, isLoading: checkingInstallation, error: installationError } = 
        api.github.checkGitHubAppInstallation.useQuery();

    // Check if project is already connected to GitHub
    const { data: existingConnection } = api.github.getProjectRepositoryConnection.useQuery(
        { projectId: editorEngine.projectId },
        { enabled: !!installationId && !installationError }
    );

    // Get organizations if installed
    const { data: organizations = [], isLoading: loadingOrgs } = 
        api.github.getOrganizations.useQuery(undefined, {
            enabled: !!installationId && currentStep === ExportStep.SELECT_OWNER,
        });

    React.useEffect(() => {
        if (existingConnection && !selectedOwner) {
            setSelectedOwner(existingConnection.repositoryOwner);
        }
    }, [existingConnection, selectedOwner]);
    const determineStep = () => {
        if (checkingInstallation) return ExportStep.INSTALLATION;
        if (installationError || !installationId) return ExportStep.INSTALLATION;
        
        if (currentStep === ExportStep.CREATE_REPOSITORY) return ExportStep.CREATE_REPOSITORY;
        
        if (existingConnection || repositoryData) return ExportStep.REPOSITORY_CONNECTED;
        if (!selectedOwner) return ExportStep.SELECT_OWNER;
        return ExportStep.CREATE_REPOSITORY;
    };

    const actualStep = determineStep();

    const renderStep = () => {
        switch (actualStep) {
            case ExportStep.INSTALLATION:
                return (
                    <InstallationStep 
                        isLoading={checkingInstallation}
                        hasError={!!installationError}
                        onInstalled={() => setCurrentStep(ExportStep.SELECT_OWNER)}
                    />
                );
            case ExportStep.SELECT_OWNER:
                return (
                    <SelectOwnerStep
                        organizations={organizations}
                        isLoading={loadingOrgs}
                        selectedOwner={selectedOwner}
                        onOwnerSelect={(owner) => {
                            setSelectedOwner(owner);
                            setCurrentStep(ExportStep.CREATE_REPOSITORY);
                        }}
                        onBack={() => setCurrentStep(ExportStep.INSTALLATION)}
                    />
                );
            case ExportStep.CREATE_REPOSITORY:
                const connectedRepoForCreation = repositoryData || (existingConnection ? {
                    id: existingConnection.repositoryId || 0,
                    name: existingConnection.repositoryName,
                    full_name: existingConnection.fullName,
                    html_url: existingConnection.repositoryUrl,
                    description: '',
                    private: true,
                    default_branch: existingConnection.branch || 'main',
                    clone_url: '',
                    owner: {
                        login: existingConnection.repositoryOwner,
                        avatar_url: '',
                    },
                } : null);
                
                return (
                    <CreateRepositoryStep
                        selectedOwner={selectedOwner}
                        onRepositoryCreated={(repo) => {
                            setRepositoryData(repo);
                        }}
                        onBack={() => {
                            setSelectedOwner('');
                            setCurrentStep(ExportStep.SELECT_OWNER);
                        }}
                        existingRepository={connectedRepoForCreation || undefined}
                        onDisconnect={() => {
                            setRepositoryData(null);
                            setSelectedOwner('');
                        }}
                    />
                );
            case ExportStep.REPOSITORY_CONNECTED:
                const connectedRepoData = repositoryData || (existingConnection ? {
                    id: 0,
                    name: existingConnection.repositoryName,
                    full_name: existingConnection.fullName,
                    html_url: existingConnection.repositoryUrl,
                    description: null,
                    private: true,
                    default_branch: 'main',
                    clone_url: '',
                    owner: {
                        login: existingConnection.repositoryOwner,
                        avatar_url: '',
                    },
                } : null);
                
                return connectedRepoData ? (
                    <RepositoryConnectedStep
                        repositoryData={connectedRepoData}
                        onBack={() => {}}
                    />
                ) : null;
            default:
                return null;
        }
    };

    return (
        <div className="rounded-md flex flex-col text-foreground-secondary">
            <div className="p-4 pb-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icons.GitHubLogo className="h-5 w-5" />
                        <h3 className="text-sm font-semibold text-foreground-primary">
                            Export to GitHub
                        </h3>
                    </div>
                    {actualStep === ExportStep.REPOSITORY_CONNECTED && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setCurrentStep(ExportStep.CREATE_REPOSITORY);
                            }}
                            className="h-6 w-6 p-0"
                        >
                            <Icons.ArrowLeft className="h-3 w-3" />
                        </Button>
                    )}
                </div>
                
                {/* Step indicator - only show when not connected */}
                {actualStep !== ExportStep.REPOSITORY_CONNECTED && (
                    <div className="flex items-center gap-2 mb-4">
                        <StepIndicator 
                            step={1} 
                            isActive={actualStep === ExportStep.INSTALLATION} 
                            isCompleted={!!installationId && !installationError} 
                            label="Install App" 
                        />
                        <div className="h-px bg-border flex-1" />
                        <StepIndicator 
                            step={2} 
                            isActive={actualStep === ExportStep.SELECT_OWNER} 
                            isCompleted={!!selectedOwner} 
                            label="Select Owner" 
                        />
                        <div className="h-px bg-border flex-1" />
                        <StepIndicator 
                            step={3} 
                            isActive={actualStep === ExportStep.CREATE_REPOSITORY} 
                            isCompleted={!!repositoryData} 
                            label="Create Repo" 
                        />
                    </div>
                )}
            </div>

            <Separator />
            
            <div className="p-4">
                {renderStep()}
            </div>
        </div>
    );
});

interface StepIndicatorProps {
    step: number;
    isActive: boolean;
    isCompleted: boolean;
    label: string;
}

const StepIndicator = ({ step, isActive, isCompleted, label }: StepIndicatorProps) => (
    <div className="flex flex-col items-center gap-1">
        <div className={cn(
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
            isCompleted 
                ? 'bg-teal-500 text-white' 
                : isActive 
                    ? 'bg-foreground-primary text-background' 
                    : 'bg-background-secondary text-foreground-secondary'
        )}>
            {isCompleted ? <Icons.Check className="h-3 w-3" /> : step}
        </div>
        <span className={cn(
            'text-xs',
            isActive ? 'text-foreground-primary' : 'text-foreground-secondary'
        )}>
            {label}
        </span>
    </div>
);

function cn(...classes: (string | undefined)[]) {
    return classes.filter(Boolean).join(' ');
}