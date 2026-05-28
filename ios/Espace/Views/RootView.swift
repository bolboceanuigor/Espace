import SwiftUI

struct RootView: View {
    @Environment(SessionStore.self) private var session
    @State private var didRestore = false

    var body: some View {
        Group {
            if session.isAuthenticated {
                ResidentTabView()
            } else {
                LoginView()
            }
        }
        .task {
            guard !didRestore else { return }
            didRestore = true
            await session.restore()
        }
    }
}

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    @State private var email = ""
    @State private var password = ""

    private var canSubmit: Bool {
        email.nonEmpty != nil && password.nonEmpty != nil && !session.isLoading
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer(minLength: 24)

                VStack(spacing: 12) {
                    Image(systemName: "building.2.crop.circle")
                        .font(.system(size: 64, weight: .semibold))
                        .foregroundStyle(.tint)
                    Text("Espace")
                        .font(.largeTitle.bold())
                    Text("Portal locatar pentru A.P.C.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 14) {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)

                    SecureField("Parola", text: $password)
                        .textContentType(.password)
                        .textFieldStyle(.roundedBorder)
                }

                if let message = session.errorMessage {
                    ErrorBanner(message: message)
                }

                VStack(spacing: 10) {
                    Button {
                        Task { await session.login(email: email, password: password) }
                    } label: {
                        Label(session.isLoading ? "Se autentifica" : "Autentificare", systemImage: "arrow.right.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!canSubmit)

                    Button {
                        Task { await session.demoLogin() }
                    } label: {
                        Label("Intra demo", systemImage: "sparkles")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(session.isLoading)
                }

                Spacer()
            }
            .padding(24)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct ResidentTabView: View {
    @Environment(AppIntentRouter.self) private var intentRouter
    @State private var selectedTab: AppTab = .home

    var body: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tabItem { Label(AppTab.home.title, systemImage: AppTab.home.systemImage) }
                .tag(AppTab.home)

            InvoicesView()
                .tabItem { Label(AppTab.invoices.title, systemImage: AppTab.invoices.systemImage) }
                .tag(AppTab.invoices)

            MetersView()
                .tabItem { Label(AppTab.meters.title, systemImage: AppTab.meters.systemImage) }
                .tag(AppTab.meters)

            RequestsView()
                .tabItem { Label(AppTab.requests.title, systemImage: AppTab.requests.systemImage) }
                .tag(AppTab.requests)

            AnnouncementsView()
                .tabItem { Label(AppTab.announcements.title, systemImage: AppTab.announcements.systemImage) }
                .tag(AppTab.announcements)

            AccountView()
                .tabItem { Label(AppTab.account.title, systemImage: AppTab.account.systemImage) }
                .tag(AppTab.account)
        }
        .onChange(of: intentRouter.requestedTab) { _, tab in
            guard let tab else { return }
            selectedTab = tab
            intentRouter.requestedTab = nil
        }
    }
}
