pipeline {
    agent {
        // Can be run on any agent with Node.js and Docker or native agent
        any
    }

    tools {
        nodejs 'Node-20'
        jdk 'JDK-17'
    }

    environment {
        CI = 'true'
        HEADLESS = 'true'
    }

    parameters {
        choice(
            name: 'SUITE',
            choices: ['positive', 'negative', 'regression', 'all'],
            description: 'Select test suite to execute'
        )
    }


    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Install Playwright Browsers') {
            steps {
                sh 'npx playwright install --with-deps chromium'
            }
        }

        stage('Execute Playwright Tests') {
            steps {
                script {
                    if (params.SUITE == 'all') {
                        sh 'npx playwright test'
                    } else {
                        sh "npx playwright test --project=${params.SUITE}"
                    }
                }
            }
        }

        stage('Generate Allure Report') {
            steps {
                sh 'npm run allure:generate || true'
            }
        }
    }

    post {
        always {
            // Archive Playwright HTML report
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Test Report'
            ])

            // Archive Allure report if Allure plugin is installed
            allure([
                includeProperties: false,
                jdk: '',
                properties: [],
                reportBuildPolicy: 'ALWAYS',
                results: [[path: 'allure-results']]
            ])
        }
        failure {
            echo "❌ Tests failed! Check the Playwright / Allure report for traces and screenshots."
        }
        success {
            echo "✅ All tests passed successfully!"
        }
    }
}
